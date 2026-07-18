/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Calendar,
  Plus,
  Edit3,
  Search,
  ChevronRight,
  Edit,
  Loader2,
  Sparkles,
  Check,
  Droplets,
  Settings,
  Settings2,
  Target,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, getDoc, setDoc } from "firebase/firestore";
import { db } from "./infrastructure/firebaseApp";
import { aiClient } from "./services/ai/aiClient";
import { isStaple } from "@/features/cart/services/staples";
import { format } from 'date-fns';

import * as pdfjs from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useNutritionPlan } from '@/app/providers/UserProfileContext';
import { useData } from '@/app/providers/DataContext';
import { TabBar } from '@/app/layout/TabBar';
import { SettingsModal } from '@/features/settings/SettingsModal';
import { CartView } from '@/features/cart/CartView';
import { ProgramsView } from '@/features/programs/ProgramsView';
import type {
  CartItem,
  Tab,
  Recipe,
  UserProfile,
  Program,
} from '@/shared/domain/types';
import { RecipesView } from '@/features/recipes/RecipesView';
import { PlannerView } from '@/features/planner/PlannerView';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const extractImageFromPDF = async (
  pdfData: string,
  pageNumber: number,
  box: { ymin: number; xmin: number; ymax: number; xmax: number },
): Promise<string> => {
  try {
    const binaryString = atob(pdfData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const loadingTask = pdfjs.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return '';
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (page as any).render({ canvasContext: context, viewport }).promise;
    const x = (box.xmin / 1000) * canvas.width;
    const y = (box.ymin / 1000) * canvas.height;
    const width = ((box.xmax - box.xmin) / 1000) * canvas.width;
    const height = ((box.ymax - box.ymin) / 1000) * canvas.height;
    if (width <= 0 || height <= 0) return canvas.toDataURL('image/jpeg');
    const cropCanvas = document.createElement('canvas');
    const cropContext = cropCanvas.getContext('2d');
    if (!cropContext) return canvas.toDataURL('image/jpeg');
    cropCanvas.width = width;
    cropCanvas.height = height;
    cropContext.drawImage(canvas, x, y, width, height, 0, 0, width, height);
    return cropCanvas.toDataURL('image/jpeg', 0.8);
  } catch {
    return '';
  }
};

const extractTextFromPDF = async (pdfData: string): Promise<string> => {
  const binaryString = atob(pdfData);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    parts.push(`--- Page ${i} ---`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parts.push(content.items.map((item: any) => item.str).join(' '));
  }
  return parts.join('\n');
};

function AddRecipeOption({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-3 transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('recipes');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  // Cross-tab recipe state (shared between Recipes tab and Programs/Planner)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [isAddingPDF, setIsAddingPDF] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  
  // Categories state
  const [availableCategories, setAvailableCategories] = useState([
    'Завтрак', 'Обед', 'Ужин', 'Перекус', 'Десерт', 'Мясо', 'Рыба', 'Веган', 'Вегетарианское', 'Напитки', 'Основное блюдо', 'Гарниры', 'Салаты', 'Супы'
  ]);
  
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [suggestion, setSuggestion] = useState<{
    options: { 
      id: string;
      type: 'recipe' | 'product';
      recipeId?: string;
      description: string; 
      macros: { calories: number; proteins: number; fats: number; carbs: number; } 
    }[];
    reason: string;
  } | null>(null);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);

  const handleSuggest = async (isAlternative = false) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayEntries = plannerEntries.filter(e => e.date === today);
    const checkedEntriesData = todayEntries.filter(e => checkedEntries.includes(e.id));
    const actualMacros = checkedEntriesData.reduce((acc, entry) => {
      const macros = entry.type === 'recipe' ? recipes.find(r => r.id === entry.recipeId)?.macros : entry.macros;
      if (macros) {
        acc.calories += macros.calories;
        acc.proteins += macros.proteins;
        acc.fats += macros.fats;
        acc.carbs += macros.carbs;
      }
      return acc;
    }, { calories: 0, proteins: 0, fats: 0, carbs: 0 });

    const currentTargets = activeNutritionPlan || {
      name: 'По умолчанию (из настроек)',
      calories: userProfile.targetCalories,
      proteins: userProfile.targetProteins,
      fats: userProfile.targetFats,
      carbs: userProfile.targetCarbs,
      allowedProducts: [],
      forbiddenProducts: []
    };

    const remaining = {
      calories: Math.max(0, currentTargets.calories - actualMacros.calories),
      proteins: Math.max(0, currentTargets.proteins - actualMacros.proteins),
      fats: Math.max(0, currentTargets.fats - actualMacros.fats),
      carbs: Math.max(0, currentTargets.carbs - actualMacros.carbs)
    };

    if (remaining.calories < 50 && !isAlternative) {
      alert("У вас осталось слишком мало калорий для рекомендаций!");
      return;
    }

    setIsSuggesting(true);
    if (!isAlternative) {
      setSuggestion(null);
      setSelectedSuggestionIds([]);
    }

    try {
      const result = await aiClient.fillRemaining({
        remaining,
        planName: currentTargets.name,
        allergies: userProfile.allergies,
        activeProgramRules: {
          allowedProducts: currentTargets.allowedProducts ?? [],
          forbiddenProducts: currentTargets.forbiddenProducts ?? [],
        },
        userRecipes: recipes.map(r => ({ id: r.id, title: r.title, macros: r.macros })),
      });

      if (isAlternative && suggestion) {
        setSuggestion({
          ...result,
          options: [...suggestion.options, ...result.options]
        });
      } else {
        setSuggestion(result);
      }
    } catch (error) {
      console.error("Error getting suggestion:", error);
      alert("Не удалось получить рекомендацию");
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleAddSelectedSuggestions = async () => {
    if (!suggestion || selectedSuggestionIds.length === 0) return;
    
    const today = format(new Date(), 'yyyy-MM-dd');
    const selectedOptions = suggestion.options.filter(opt => selectedSuggestionIds.includes(opt.id));
    
    try {
      for (const option of selectedOptions) {
        const entryData: any = {
          date: today,
          mealType: 'Перекус', // Default to snack for suggestions
          createdAt: new Date().toISOString()
        };

        if (option.type === 'recipe' && option.recipeId) {
          entryData.type = 'recipe';
          entryData.recipeId = option.recipeId;
        } else {
          entryData.type = 'product';
          entryData.productName = option.description;
          entryData.macros = option.macros;
        }

        await addDoc(collection(db, "planner"), entryData);
      }
      
      setSuggestion(null);
      setSelectedSuggestionIds([]);
      alert("Выбранные варианты добавлены в ваш рацион на сегодня!");
    } catch (error) {
      console.error("Error adding suggestions:", error);
      alert("Не удалось добавить варианты в рацион");
    }
  };
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<'ru' | 'de' | 'en'>('ru');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isRecipeSelectionMode, setIsRecipeSelectionMode] = useState(false);
  const [selectionTarget, setSelectionTarget] = useState<{ programId: string, subfolderId: string | 'main' } | null>(null);
  const [recipeTarget, setRecipeTarget] = useState<{ programId: string, subfolderId: string | 'main' } | null>(null);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: '',
    age: 30,
    gender: 'female',
    currentWeight: 65,
    targetWeight: 60,
    targetCalories: 1800,
    targetProteins: 100,
    targetFats: 60,
    targetCarbs: 200,
    waterGoal: 2000,
    allergies: []
  });
  const [checkedEntries, setCheckedEntries] = useState<string[]>([]);
  const [mealTypes, setMealTypes] = useState(['Завтрак', 'Обед', 'Ужин', 'Перекус']);
  const [openProgramId, setOpenProgramId] = useState<string | null>(null);
  const [isProgramSelectionOpen, setIsProgramSelectionOpen] = useState(false);
  const { activeNutritionPlan, setActivePlan } = useNutritionPlan();
  const { programs, plannerEntries } = useData();
  const [customPlanForm, setCustomPlanForm] = useState({
    name: '',
    calories: 0,
    proteins: 0,
    fats: 0,
    carbs: 0
  });

  const handleStartRecipeSelection = (programId: string, subfolderId: string | 'main') => {
    setSelectionTarget({ programId, subfolderId });
    setIsRecipeSelectionMode(true);
    setSelectedRecipeIds([]);
    setActiveTab('recipes');
    setOpenProgramId(null);
  };

  const handleAddSelectedRecipes = async () => {
    if (!selectionTarget) return;
    const { programId, subfolderId } = selectionTarget;
    const program = programs.find(p => p.id === programId);
    if (!program) return;

    try {
      if (subfolderId === 'main') {
        const newRecipeIds = Array.from(new Set([...program.recipeIds, ...selectedRecipeIds]));
        await updateDoc(doc(db, "programs", programId), { recipeIds: newRecipeIds });
      } else {
        const newSubfolders = program.subfolders?.map(sf => {
          if (sf.id === subfolderId) {
            return { ...sf, recipeIds: Array.from(new Set([...sf.recipeIds, ...selectedRecipeIds])) };
          }
          return sf;
        });
        await updateDoc(doc(db, "programs", programId), { subfolders: newSubfolders });
      }

      setIsRecipeSelectionMode(false);
      setSelectionTarget(null);
      setSelectedRecipeIds([]);
      setOpenProgramId(programId);
    } catch (error) {
      console.error("Error adding recipes:", error);
      alert("Не удалось добавить рецепты");
    }
  };

  const addProductsToCart = async (products: string[]) => {
    try {
      for (const product of products) {
        if (!product.trim()) continue;

        // Try to separate name and amount if possible (e.g. "Яблоки 1кг")
        const parts = product.trim().split(' ');
        let name = product;
        let amount = '';

        if (parts.length > 1) {
          const lastPart = parts[parts.length - 1];
          if (lastPart && /\d/.test(lastPart)) {
            amount = lastPart;
            name = parts.slice(0, -1).join(' ');
          }
        }

        const isBasic = isStaple(name);

        await addDoc(collection(db, "cart"), {
          name,
          amount,
          sourceDishes: ['Из программы'],
          checked: false,
          isBasic,
          createdAt: new Date().toISOString()
        });
      }
      alert("Продукты добавлены в корзину!");
    } catch (error) {
      console.error("Error adding to cart:", error);
      alert("Ошибка при добавлении в корзину");
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const programId = urlParams.get('programId');
    if (programId) {
      const handleSharedProgram = async () => {
        // Fetch program to verify it exists
        const programDoc = await getDoc(doc(db, "programs", programId));
        if (programDoc.exists()) {
          const programData = programDoc.data() as Program;
          if (confirm(`Добавить программу "${programData.name}"?`)) {
            // Since we removed collections, we just open it or something?
            // Actually, the user wants to remove collections altogether.
            // If someone shares a program, maybe we should just show it?
            // For now, let's just clear the URL.
            setOpenProgramId(programId);
            setActiveTab('programs');
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } else {
          alert("Программа не найдена.");
        }
      };
      handleSharedProgram();
    }
  }, []);

  // Sync with Firestore
  useEffect(() => {
    const q = query(collection(db, "recipes"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const recipesData: Recipe[] = [];
      querySnapshot.forEach((doc) => {
        recipesData.push({ id: doc.id, ...doc.data() } as Recipe);
      });
      setRecipes(recipesData);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "cart"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const cartData: CartItem[] = [];
      querySnapshot.forEach((doc) => {
        cartData.push({ id: doc.id, ...doc.data() } as CartItem);
      });
      setCart(cartData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "settings", "profile"), (doc) => {
      if (doc.exists()) {
        setUserProfile(doc.data() as UserProfile);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const savedCategories = localStorage.getItem('availableCategories');
    if (savedCategories) {
      try {
        setAvailableCategories(JSON.parse(savedCategories));
      } catch (e) {
        console.error("Error parsing saved categories:", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('availableCategories', JSON.stringify(availableCategories));
  }, [availableCategories]);






  const renderTracker = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayEntries = plannerEntries.filter(e => e.date === today);
    
    const checkedEntriesData = todayEntries.filter(e => checkedEntries.includes(e.id));
    
    const actualMacros = checkedEntriesData.reduce((acc, entry) => {
      const macros = entry.type === 'recipe' 
        ? recipes.find(r => r.id === entry.recipeId)?.macros 
        : entry.macros;
      
      if (macros) {
        acc.calories += macros.calories;
        acc.proteins += macros.proteins;
        acc.fats += macros.fats;
        acc.carbs += macros.carbs;
      }
      return acc;
    }, { calories: 0, proteins: 0, fats: 0, carbs: 0 });

    const currentTargets = activeNutritionPlan || {
      name: 'По умолчанию (из настроек)',
      calories: userProfile.targetCalories,
      proteins: userProfile.targetProteins,
      fats: userProfile.targetFats,
      carbs: userProfile.targetCarbs
    };

    const remainingMacros = {
      calories: Math.max(0, currentTargets.calories - actualMacros.calories),
      proteins: Math.max(0, currentTargets.proteins - actualMacros.proteins),
      fats: Math.max(0, currentTargets.fats - actualMacros.fats),
      carbs: Math.max(0, currentTargets.carbs - actualMacros.carbs)
    };

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-zinc-900">Трекер твоего питания сегодня</h2>
          <p className="text-zinc-500 text-sm">Следи за прогрессом и достигай своих целей</p>
        </div>

        {/* Water Reminder */}
        <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
              <Droplets className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-blue-900">Не забудь пить достаточно воды сегодня!</h3>
              <p className="text-blue-700 text-sm">Твоя цель: {userProfile.waterGoal} мл</p>
            </div>
          </div>
          <div className="text-blue-600 font-bold text-xl">
            {Math.round((userProfile.currentWeight * 35))} мл/день
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase">Текущий план</p>
              <h3 className="text-sm font-bold text-zinc-900">
                {currentTargets.name}
                {activeNutritionPlan?.subfolderName && (
                  <span className="text-emerald-600 ml-1">/ {activeNutritionPlan.subfolderName}</span>
                )}
              </h3>
            </div>
          </div>
          <button 
            onClick={() => setIsProgramSelectionOpen(true)}
            className="flex items-center gap-2 bg-white border border-zinc-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-zinc-50 transition-all shadow-sm"
          >
            <Settings2 className="w-4 h-4" />
            Выбрать программу
          </button>
        </div>

        {/* Macros Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={cn(
            "bg-white p-6 rounded-3xl border shadow-sm transition-all duration-300",
            actualMacros.calories > currentTargets.calories ? "border-red-500 shadow-red-50" : "border-zinc-100"
          )}>
            <p className="text-xs font-bold text-zinc-400 uppercase mb-1">Калории</p>
            <div className="flex items-end gap-2">
              <span className={cn("text-2xl font-bold", actualMacros.calories > currentTargets.calories ? "text-red-600" : "text-zinc-900")}>
                {actualMacros.calories}
              </span>
              <span className="text-zinc-400 text-sm mb-1">/ {currentTargets.calories} ккал</span>
            </div>
            {actualMacros.calories > currentTargets.calories && (
              <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> вы превысили норму
              </p>
            )}
            <div className="mt-4 h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-500", actualMacros.calories > currentTargets.calories ? "bg-red-500" : "bg-emerald-500")}
                style={{ width: `${Math.min(100, (actualMacros.calories / currentTargets.calories) * 100)}%` }}
              />
            </div>
          </div>
          <div className={cn(
            "bg-white p-6 rounded-3xl border shadow-sm transition-all duration-300",
            actualMacros.proteins > currentTargets.proteins ? "border-red-500 shadow-red-50" : "border-zinc-100"
          )}>
            <p className="text-xs font-bold text-zinc-400 uppercase mb-1">Белки</p>
            <div className="flex items-end gap-2">
              <span className={cn("text-2xl font-bold", actualMacros.proteins > currentTargets.proteins ? "text-red-600" : "text-zinc-900")}>
                {actualMacros.proteins}г
              </span>
              <span className="text-zinc-400 text-sm mb-1">/ {currentTargets.proteins}г</span>
            </div>
            {actualMacros.proteins > currentTargets.proteins && (
              <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> вы превысили норму
              </p>
            )}
            <div className="mt-4 h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-500", actualMacros.proteins > currentTargets.proteins ? "bg-red-500" : "bg-blue-500")}
                style={{ width: `${Math.min(100, (actualMacros.proteins / currentTargets.proteins) * 100)}%` }}
              />
            </div>
          </div>
          <div className={cn(
            "bg-white p-6 rounded-3xl border shadow-sm transition-all duration-300",
            actualMacros.fats > currentTargets.fats ? "border-red-500 shadow-red-50" : "border-zinc-100"
          )}>
            <p className="text-xs font-bold text-zinc-400 uppercase mb-1">Жиры</p>
            <div className="flex items-end gap-2">
              <span className={cn("text-2xl font-bold", actualMacros.fats > currentTargets.fats ? "text-red-600" : "text-zinc-900")}>
                {actualMacros.fats}г
              </span>
              <span className="text-zinc-400 text-sm mb-1">/ {currentTargets.fats}г</span>
            </div>
            {actualMacros.fats > currentTargets.fats && (
              <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> вы превысили норму
              </p>
            )}
            <div className="mt-4 h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-500", actualMacros.fats > currentTargets.fats ? "bg-red-500" : "bg-orange-500")}
                style={{ width: `${Math.min(100, (actualMacros.fats / currentTargets.fats) * 100)}%` }}
              />
            </div>
          </div>
          <div className={cn(
            "bg-white p-6 rounded-3xl border shadow-sm transition-all duration-300",
            actualMacros.carbs > currentTargets.carbs ? "border-red-500 shadow-red-50" : "border-zinc-100"
          )}>
            <p className="text-xs font-bold text-zinc-400 uppercase mb-1">Углеводы</p>
            <div className="flex items-end gap-2">
              <span className={cn("text-2xl font-bold", actualMacros.carbs > currentTargets.carbs ? "text-red-600" : "text-zinc-900")}>
                {actualMacros.carbs}г
              </span>
              <span className="text-zinc-400 text-sm mb-1">/ {currentTargets.carbs}г</span>
            </div>
            {actualMacros.carbs > currentTargets.carbs && (
              <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> вы превысили норму
              </p>
            )}
            <div className="mt-4 h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-500", actualMacros.carbs > currentTargets.carbs ? "bg-red-500" : "bg-purple-500")}
                style={{ width: `${Math.min(100, (actualMacros.carbs / currentTargets.carbs) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Planner Logic Restoration: Today's Meals */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-zinc-900">Твой план на сегодня</h3>
          {todayEntries.length === 0 ? (
            <div className="bg-white rounded-3xl border border-zinc-100 p-12 text-center">
              <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-zinc-200" />
              </div>
              <p className="text-zinc-500 text-sm">На сегодня ничего не запланировано</p>
              <button 
                onClick={() => setActiveTab('planner')}
                className="mt-4 text-emerald-600 font-bold hover:text-emerald-700"
              >
                Перейти в планер
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {mealTypes.map(meal => {
                const mealEntries = todayEntries.filter(e => e.mealType === meal);
                if (mealEntries.length === 0) return null;
                
                return (
                  <div key={meal} className="bg-white rounded-3xl border border-zinc-100 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 bg-zinc-50/50 border-b border-zinc-100 flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{meal}</h4>
                    </div>
                    <div className="divide-y divide-zinc-50">
                      {mealEntries.map(entry => {
                        const isChecked = checkedEntries.includes(entry.id);
                        const recipe = entry.type === 'recipe' ? recipes.find(r => r.id === entry.recipeId) : null;
                        const title = entry.type === 'recipe' ? recipe?.title : entry.productName;
                        const calories = entry.type === 'recipe' ? recipe?.macros.calories : entry.macros?.calories;
                        
                        return (
                          <div key={entry.id} className="p-4 flex items-center gap-4 group">
                            <button 
                              onClick={() => {
                                if (isChecked) {
                                  setCheckedEntries(checkedEntries.filter(id => id !== entry.id));
                                } else {
                                  setCheckedEntries([...checkedEntries, entry.id]);
                                }
                              }}
                              className={cn(
                                "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                                isChecked ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-200 text-transparent"
                              )}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <div className="flex-1">
                              <p className={cn("font-bold text-zinc-900", isChecked && "line-through opacity-50")}>{title}</p>
                              <p className="text-xs text-zinc-400">{calories} ккал</p>
                            </div>
                            {entry.type === 'recipe' && recipe && (
                              <button 
                                onClick={() => setSelectedRecipe(recipe)}
                                className="p-2 text-zinc-300 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <ChevronRight className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      {/* Suggestion Section */}
      <div className="pt-8 border-t border-zinc-100">
        <div className="flex flex-col items-start gap-4">
          <button 
            onClick={() => handleSuggest(false)}
            disabled={isSuggesting}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSuggesting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Подбираем варианты...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Заполнить остаток кбжу</span>
              </>
            )}
          </button>
          <p className="text-zinc-500 text-sm max-w-md">
            Ты не знаешь что съесть на остаток твоих кбжу сегодня? Нажми на кнопку и получи варианты на выбор
          </p>
        </div>

        <AnimatePresence>
          {suggestion && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-8 space-y-6"
            >
              <div className="bg-emerald-50 rounded-3xl p-6 border border-emerald-100">
                <h4 className="font-bold text-emerald-900 mb-1 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Рекомендации для тебя
                </h4>
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-3">
                  Подобрано согласно вашему плану: {activeNutritionPlan?.name || 'По умолчанию'}
                </p>
                <p className="text-emerald-700 text-sm mb-6">{suggestion.reason}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {suggestion.options.map((option) => (
                    <div 
                      key={option.id}
                      className={cn(
                        "bg-white p-4 rounded-2xl border transition-all cursor-pointer",
                        selectedSuggestionIds.includes(option.id) ? "border-emerald-500 shadow-md" : "border-zinc-100 hover:border-emerald-200"
                      )}
                      onClick={() => {
                        if (selectedSuggestionIds.includes(option.id)) {
                          setSelectedSuggestionIds(selectedSuggestionIds.filter(id => id !== option.id));
                        } else {
                          setSelectedSuggestionIds([...selectedSuggestionIds, option.id]);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all mt-1",
                          selectedSuggestionIds.includes(option.id) ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-200 text-transparent"
                        )}>
                          <Check className="w-3 h-3" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-zinc-900 text-sm mb-2">{option.description}</p>
                          <div className="flex gap-3 text-[10px] font-bold text-zinc-400 uppercase">
                            <span className="text-emerald-600">{option.macros.calories} ккал</span>
                            <span>Б: {option.macros.proteins}г</span>
                            <span>Ж: {option.macros.fats}г</span>
                            <span>У: {option.macros.carbs}г</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 mt-6">
                  {selectedSuggestionIds.length > 0 && (
                    <button 
                      onClick={handleAddSelectedSuggestions}
                      className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                    >
                      Добавить в рацион
                    </button>
                  )}
                  <button 
                    onClick={() => handleSuggest(true)}
                    disabled={isSuggesting}
                    className="flex-1 py-4 bg-white border border-emerald-200 text-emerald-600 rounded-2xl font-bold hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                  >
                    {isSuggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Предложить альтернативу
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};



  const renderContent = () => {
    switch (activeTab) {
      case 'recipes':
        return (
          <RecipesView
            recipes={recipes}
            programs={programs}
            availableCategories={availableCategories}
            userProfile={userProfile}
            onOpenSettings={() => setIsSettingsOpen(true)}
            photoInputRef={photoInputRef}
            recipeTarget={recipeTarget}
            onRecipeTargetCleared={() => setRecipeTarget(null)}
            isRecipeSelectionMode={isRecipeSelectionMode}
            selectionTarget={selectionTarget}
            selectedRecipeIds={selectedRecipeIds}
            onSelectedRecipeIdsChange={setSelectedRecipeIds}
            selectedRecipe={selectedRecipe}
            onSelectedRecipeChange={setSelectedRecipe}
            isAddingManual={isAddingManual}
            onIsAddingManualChange={setIsAddingManual}
            isAddingLink={isAddingLink}
            onIsAddingLinkChange={setIsAddingLink}
            isAddingPDF={isAddingPDF}
            onIsAddingPDFChange={setIsAddingPDF}
            isScanning={isScanning}
            onIsScanningChange={setIsScanning}
          />
        );
      case 'planner':
        return (
          <PlannerView
            recipes={recipes}
            userProfile={userProfile}
            activeNutritionPlan={activeNutritionPlan}
            checkedEntries={checkedEntries}
            onCheckedEntriesChange={setCheckedEntries}
            onSelectRecipe={setSelectedRecipe}
            onNavigateToCart={() => setActiveTab('cart')}
            mealTypes={mealTypes}
            onMealTypesChange={setMealTypes}
          />
        );
      case 'cart':
        return <CartView cart={cart} />;
      case 'tracker':
        return renderTracker();
      case 'programs':
        return (
          <ProgramsView
            recipes={recipes}
            availableCategories={availableCategories}
            userProfile={userProfile}
            openProgramId={openProgramId}
            onOpenProgramIdChange={setOpenProgramId}
            isRecipeSelectionMode={isRecipeSelectionMode}
            selectionTarget={selectionTarget}
            selectedRecipeIds={selectedRecipeIds}
            onSelectedRecipeIdsChange={setSelectedRecipeIds}
            onStartRecipeSelection={handleStartRecipeSelection}
            onAddSelectedRecipes={handleAddSelectedRecipes}
            recipeTarget={recipeTarget}
            onRecipeTargetCleared={() => setRecipeTarget(null)}
            onRecipeTargetSet={setRecipeTarget}
            photoInputRef={photoInputRef}
            isAddingManual={isAddingManual} onIsAddingManualChange={setIsAddingManual}
            isAddingLink={isAddingLink} onIsAddingLinkChange={setIsAddingLink}
            isAddingPDF={isAddingPDF} onIsAddingPDFChange={setIsAddingPDF}
            isScanning={isScanning} onIsScanningChange={setIsScanning}
            onAddProductsToCart={addProductsToCart}
            onSelectRecipe={setSelectedRecipe}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">

      <AnimatePresence>
        {isSuggesting && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsSuggesting(false);
                setSuggestion(null);
              }}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-zinc-900">Рекомендация ИИ</h2>
                </div>
                <button onClick={() => {
                  setIsSuggesting(false);
                  setSuggestion(null);
                }} className="text-zinc-400 hover:text-zinc-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              {!suggestion ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" />
                  <p className="text-zinc-500 font-medium">Анализирую ваши КБЖУ и рецепты...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                    <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-4">Рекомендация на остаток кбжу на день</h3>
                    
                    <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                      {suggestion.options.map((option) => (
                        <div 
                          key={option.id} 
                          className={cn(
                            "bg-white p-4 rounded-xl border transition-all cursor-pointer relative group",
                            selectedSuggestionIds.includes(option.id) ? "border-emerald-500 shadow-md ring-1 ring-emerald-500" : "border-emerald-100 shadow-sm hover:border-emerald-300"
                          )}
                          onClick={() => {
                            setSelectedSuggestionIds(prev => 
                              prev.includes(option.id) ? prev.filter(id => id !== option.id) : [...prev, option.id]
                            );
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 mt-0.5",
                              selectedSuggestionIds.includes(option.id) ? "bg-emerald-600 border-emerald-600 text-white" : "border-zinc-200 bg-white"
                            )}>
                              {selectedSuggestionIds.includes(option.id) && <Check className="w-3.5 h-3.5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-bold text-zinc-900 text-sm leading-tight">
                                  {option.type === 'recipe' ? `Рецепт: ${option.description}` : option.description}
                                </span>
                                <span className="text-xs font-bold text-emerald-600 ml-2 whitespace-nowrap">{option.macros.calories} ккал</span>
                              </div>
                              <div className="flex gap-3 text-[10px] font-bold text-zinc-400 uppercase">
                                <span>Б: {option.macros.proteins}г</span>
                                <span>Ж: {option.macros.fats}г</span>
                                <span>У: {option.macros.carbs}г</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <p className="text-emerald-700 text-sm mt-6 italic">"{suggestion.reason}"</p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      disabled={selectedSuggestionIds.length === 0}
                      onClick={async () => {
                        const selectedOptions = suggestion.options.filter(opt => selectedSuggestionIds.includes(opt.id));
                        for (const option of selectedOptions) {
                          await addDoc(collection(db, "planner"), {
                            date: format(new Date(), 'yyyy-MM-dd'),
                            mealType: 'Перекус',
                            type: option.type,
                            recipeId: option.recipeId || null,
                            productName: option.type === 'product' ? option.description : null,
                            macros: option.macros,
                            createdAt: new Date().toISOString()
                          });
                        }
                        setIsSuggesting(false);
                        setSuggestion(null);
                      }}
                      className={cn(
                        "w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg",
                        selectedSuggestionIds.length > 0 
                          ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100" 
                          : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                      )}
                    >
                      <Plus className="w-5 h-5" />
                      Добавить в рацион ({selectedSuggestionIds.length})
                    </button>

                    <button
                      onClick={() => handleSuggest(true)}
                      className="w-full py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Предложить другие варианты
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white border-b border-zinc-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-auto py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-200">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight font-display">Рецепт Менеджер</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button 
                  onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                  className="p-2 bg-zinc-100 text-zinc-600 rounded-xl hover:bg-zinc-200 transition-all flex items-center justify-center min-w-[40px]"
                >
                  <span className="text-lg">
                    {currentLanguage === 'ru' ? '🇷🇺' : currentLanguage === 'de' ? '🇩🇪' : '🇺🇸'}
                  </span>
                </button>

                <AnimatePresence>
                  {isLanguageDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsLanguageDropdownOpen(false)}
                      />
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-32 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden z-50"
                      >
                        <button 
                          onClick={() => { setCurrentLanguage('ru'); setIsLanguageDropdownOpen(false); }}
                          className={cn(
                            "w-full px-4 py-3 text-left text-sm font-bold flex items-center gap-3 hover:bg-zinc-50 transition-colors",
                            currentLanguage === 'ru' ? "text-emerald-600 bg-emerald-50/50" : "text-zinc-600"
                          )}
                        >
                          <span>🇷🇺</span> Русский
                        </button>
                        <button 
                          onClick={() => { setCurrentLanguage('de'); setIsLanguageDropdownOpen(false); }}
                          className={cn(
                            "w-full px-4 py-3 text-left text-sm font-bold flex items-center gap-3 hover:bg-zinc-50 transition-colors",
                            currentLanguage === 'de' ? "text-emerald-600 bg-emerald-50/50" : "text-zinc-600"
                          )}
                        >
                          <span>🇩🇪</span> Deutsch
                        </button>
                        <button 
                          onClick={() => { setCurrentLanguage('en'); setIsLanguageDropdownOpen(false); }}
                          className={cn(
                            "w-full px-4 py-3 text-left text-sm font-bold flex items-center gap-3 hover:bg-zinc-50 transition-colors",
                            currentLanguage === 'en' ? "text-emerald-600 bg-emerald-50/50" : "text-zinc-600"
                          )}
                        >
                          <span>🇺🇸</span> English
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 bg-zinc-100 text-zinc-600 rounded-xl hover:bg-zinc-200 transition-all"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Recipe Selection Bar */}
      <AnimatePresence>
        {isRecipeSelectionMode && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-24 left-4 right-4 z-50 flex justify-center"
          >
            <div className="bg-zinc-900 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-8 border border-white/10 backdrop-blur-xl">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Выбрано</span>
                <span className="text-xl font-bold text-emerald-400">{selectedRecipeIds.length} рецептов</span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    setIsRecipeSelectionMode(false);
                    setSelectionTarget(null);
                    setSelectedRecipeIds([]);
                    if (selectionTarget?.programId) {
                      setOpenProgramId(selectionTarget.programId);
                    }
                  }}
                  className="px-6 py-2.5 rounded-xl font-bold text-zinc-400 hover:text-white transition-colors"
                >
                  Отмена
                </button>
                <button 
                  onClick={handleAddSelectedRecipes}
                  disabled={selectedRecipeIds.length === 0}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>Добавить</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Program Selection Modal */}
      <AnimatePresence>
        {isProgramSelectionOpen && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProgramSelectionOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-lg font-bold">Выбрать программу питания</h3>
                <button onClick={() => setIsProgramSelectionOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                {/* Custom Plan Form */}
                <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 space-y-4">
                  <h4 className="font-bold text-emerald-900 flex items-center gap-2">
                    <Edit3 className="w-4 h-4" />
                    Свой план питания
                  </h4>
                  <div className="space-y-3">
                    <input 
                      type="text"
                      placeholder="Название плана (напр. Сушка)"
                      value={customPlanForm.name}
                      onChange={e => setCustomPlanForm({ ...customPlanForm, name: e.target.value })}
                      className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input 
                        type="number"
                        placeholder="Ккал"
                        value={customPlanForm.calories || ''}
                        onChange={e => setCustomPlanForm({ ...customPlanForm, calories: parseInt(e.target.value) || 0 })}
                        className="bg-white border border-emerald-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                      />
                      <input 
                        type="number"
                        placeholder="Белки (г)"
                        value={customPlanForm.proteins || ''}
                        onChange={e => setCustomPlanForm({ ...customPlanForm, proteins: parseInt(e.target.value) || 0 })}
                        className="bg-white border border-emerald-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                      />
                      <input 
                        type="number"
                        placeholder="Жиры (г)"
                        value={customPlanForm.fats || ''}
                        onChange={e => setCustomPlanForm({ ...customPlanForm, fats: parseInt(e.target.value) || 0 })}
                        className="bg-white border border-emerald-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                      />
                      <input 
                        type="number"
                        placeholder="Углеводы (г)"
                        value={customPlanForm.carbs || ''}
                        onChange={e => setCustomPlanForm({ ...customPlanForm, carbs: parseInt(e.target.value) || 0 })}
                        className="bg-white border border-emerald-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                      />
                    </div>
                    <button 
                      onClick={async () => {
                        if (!customPlanForm.name) return;
                        
                        // Save to Firestore so it appears in "Available Programs"
                        const newProgram = {
                          name: customPlanForm.name,
                          description: "Свой план питания",
                          creator: userProfile.name || "Я",
                          targetCalories: customPlanForm.calories,
                          targetProteins: customPlanForm.proteins,
                          targetFats: customPlanForm.fats,
                          targetCarbs: customPlanForm.carbs,
                          recipeIds: [],
                          subfolders: [],
                          createdAt: new Date().toISOString()
                        };
                        
                        const docRef = await addDoc(collection(db, "programs"), newProgram);

                        void setActivePlan({
                          ...customPlanForm,
                          isCustom: true,
                          programId: docRef.id,
                          allowedProducts: [],
                          forbiddenProducts: [],
                        });
                        
                        setCustomPlanForm({ name: '', calories: 0, proteins: 0, fats: 0, carbs: 0 });
                        setIsProgramSelectionOpen(false);
                      }}
    className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-sm"
  >
    Применить свой план
  </button>
</div>
</div>

{/* Existing Programs */}
<div className="space-y-3">
<h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Доступные программы</h4>

{/* Default Option */}
<button 
  onClick={() => {
    void setActivePlan(null);
    setIsProgramSelectionOpen(false);
  }}
                    className={cn(
                      "w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group",
                      !activeNutritionPlan 
                        ? "bg-emerald-50 border-emerald-200 shadow-sm" 
                        : "bg-white border-zinc-100 hover:border-emerald-200"
                    )}
                  >
                    <div>
                      <h5 className="font-bold text-zinc-900">По умолчанию</h5>
                      <p className="text-xs text-zinc-500">Данные из ваших настроек профиля</p>
                    </div>
                    {!activeNutritionPlan && <Check className="w-5 h-5 text-emerald-600" />}
                  </button>

                  {programs.map(program => (
                    <div key={program.id} className="space-y-2">
                      <button 
                        onClick={() => {
                          const plan = {
                            name: program.name,
                            calories: program.targetCalories || userProfile.targetCalories,
                            proteins: program.targetProteins || userProfile.targetProteins,
                            fats: program.targetFats || userProfile.targetFats,
                            carbs: program.targetCarbs || userProfile.targetCarbs,
                            isCustom: false,
                            programId: program.id,
                            allowedProducts: program.allowedProducts,
                            forbiddenProducts: program.forbiddenProducts
                          };
                          void setActivePlan(plan);
                          setIsProgramSelectionOpen(false);
                        }}
                        className={cn(
                          "w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group",
                          activeNutritionPlan?.programId === program.id && !activeNutritionPlan?.subfolderId
                            ? "bg-emerald-50 border-emerald-200 shadow-sm" 
                            : "bg-white border-zinc-100 hover:border-emerald-200"
                        )}
                      >
                        <div>
                          <h5 className="font-bold text-zinc-900">{program.name}</h5>
                          {program.targetCalories ? (
                            <p className="text-xs text-emerald-600 font-medium">
                              {program.targetCalories} ккал • Б:{program.targetProteins} Ж:{program.targetFats} У:{program.targetCarbs}
                            </p>
                          ) : (
                            <p className="text-xs text-zinc-400 italic">КБЖУ не заданы (будут взяты из настроек)</p>
                          )}
                        </div>
                        {activeNutritionPlan?.programId === program.id && !activeNutritionPlan?.subfolderId && <Check className="w-5 h-5 text-emerald-600" />}
                      </button>
                      
                      {program.subfolders && program.subfolders.length > 0 && (
                        <div className="pl-6 space-y-2">
                          {program.subfolders.map(subfolder => (
                            <button 
                              key={subfolder.id}
                              onClick={() => {
                                const plan = {
                                  name: program.name,
                                  subfolderName: subfolder.name,
                                  calories: subfolder.targetCalories || program.targetCalories || userProfile.targetCalories,
                                  proteins: subfolder.targetProteins || program.targetProteins || userProfile.targetProteins,
                                  fats: subfolder.targetFats || program.targetFats || userProfile.targetFats,
                                  carbs: subfolder.targetCarbs || program.targetCarbs || userProfile.targetCarbs,
                                  isCustom: false,
                                  programId: program.id,
                                  subfolderId: subfolder.id,
                                  allowedProducts: subfolder.allowedProducts || program.allowedProducts,
                                  forbiddenProducts: subfolder.forbiddenProducts || program.forbiddenProducts
                                };
                                void setActivePlan(plan);
                                setIsProgramSelectionOpen(false);
                              }}
                              className={cn(
                                "w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between group",
                                activeNutritionPlan?.subfolderId === subfolder.id 
                                  ? "bg-emerald-50 border-emerald-200 shadow-sm" 
                                  : "bg-white border-zinc-50 hover:border-emerald-100"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                                <div>
                                  <h6 className="text-sm font-bold text-zinc-700">{subfolder.name}</h6>
                                  {subfolder.targetCalories && (
                                    <p className="text-[10px] text-emerald-600 font-medium">
                                      {subfolder.targetCalories} ккал • Б:{subfolder.targetProteins} Ж:{subfolder.targetFats} У:{subfolder.targetCarbs}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {activeNutritionPlan?.subfolderId === subfolder.id && <Check className="w-4 h-4 text-emerald-600" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userProfile={userProfile}
        setUserProfile={setUserProfile}
        availableCategories={availableCategories}
        setAvailableCategories={setAvailableCategories}
        onCategoryRemoved={() => {}}
      />
    </div>
  );
}
