/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  Calendar, 
  ShoppingCart, 
  Activity, 
  Users, 
  Plus, 
  Camera, 
  FileText, 
  Link as LinkIcon, 
  Edit3,
  Search,
  ChevronRight,
  Share2,
  FolderPlus,
  FolderHeart,
  Trash2,
  Edit2,
  Edit,
  MoreVertical,
  List,
  ChefHat,
  Filter,
  ChevronLeft,
  Download,
  Loader2,
  Sparkles,
  Check,
  Droplets,
  Settings,
  Settings2,
  Target,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ExternalLink,
  FileDown,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, getDoc, setDoc } from "firebase/firestore";
import { db } from "./infrastructure/firebaseApp";
import { aiClient } from "./services/ai/aiClient";
import { isStaple } from "@/features/cart/services/staples";
import {
  format, 
  addDays, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  startOfMonth, 
  endOfMonth, 
  subDays,
  addMonths,
  subMonths,
  isToday,
  parseISO
} from 'date-fns';
import { ru } from 'date-fns/locale';

import * as pdfjs from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useNutritionPlan } from '@/app/providers/UserProfileContext';
import { TabBar } from '@/app/layout/TabBar';
import { SettingsModal } from '@/features/settings/SettingsModal';
import { CartView } from '@/features/cart/CartView';
import type {
  CartItem,
  Tab,
  Recipe,
  UserProfile,
  Program,
  PlannerEntry,
  PlannerViewScale,
  PlannerViewMode,
  Subfolder,
  Resource,
} from '@/shared/domain/types';
import { RecipesView } from '@/features/recipes/RecipesView';

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
  const programPhotoInputRef = React.useRef<HTMLInputElement>(null);
  const programPdfInputRef = React.useRef<HTMLInputElement>(null);
  const subfolderPhotoInputRef = React.useRef<HTMLInputElement>(null);
  const subfolderPdfInputRef = React.useRef<HTMLInputElement>(null);

  // Cross-tab recipe state (shared between Recipes tab and Programs/Planner)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [isAddingPDF, setIsAddingPDF] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Resource adding state
  const [activeResourceForm, setActiveResourceForm] = useState<{
    targetId: string; // subfolder.id or 'main'
    type: 'link' | 'pdf';
  } | null>(null);
  const [resourceFormData, setResourceFormData] = useState({ url: '', title: '', description: '' });
  
  // Categories state
  const [availableCategories, setAvailableCategories] = useState([
    'Завтрак', 'Обед', 'Ужин', 'Перекус', 'Десерт', 'Мясо', 'Рыба', 'Веган', 'Вегетарианское', 'Напитки', 'Основное блюдо', 'Гарниры', 'Салаты', 'Супы'
  ]);
  
  
  // Planner state
  const [plannerEntries, setPlannerEntries] = useState<PlannerEntry[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [plannerViewScale, setPlannerViewScale] = useState<PlannerViewScale>('week');
  const [plannerViewMode, setPlannerViewMode] = useState<PlannerViewMode>('calendar');
  const [selectedPlannerDate, setSelectedPlannerDate] = useState(new Date());
  const [isRecipePickerOpen, setIsRecipePickerOpen] = useState(false);
  const [isMainRecipesOpen, setIsMainRecipesOpen] = useState(true);
  const [pickingMealInfo, setPickingMealInfo] = useState<{date: string, mealType: string} | null>(null);
  const [subfolderToDelete, setSubfolderToDelete] = useState<{programId: string, subfolderId: string, name: string} | null>(null);
  const [programToDelete, setProgramToDelete] = useState<Program | null>(null);
  const [showProducts, setShowProducts] = useState(false);
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
  const [isCollectionPickerOpen, setIsCollectionPickerOpen] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [editingEntity, setEditingEntity] = useState<{ type: 'program' | 'subfolder', id: string, programId?: string } | null>(null);
  const [editFormData, setEditFormData] = useState({ 
    name: '', 
    description: '',
    targetCalories: 0,
    targetProteins: 0,
    targetFats: 0,
    targetCarbs: 0,
    resources: [] as Resource[],
    allowedProducts: [] as string[],
    forbiddenProducts: [] as string[]
  });
  const [isEditingProgramInline, setIsEditingProgramInline] = useState(false);
  const [isRecipeSelectionMode, setIsRecipeSelectionMode] = useState(false);
  const [selectionTarget, setSelectionTarget] = useState<{ programId: string, subfolderId: string | 'main' } | null>(null);
  const [recipeTarget, setRecipeTarget] = useState<{ programId: string, subfolderId: string | 'main' } | null>(null);
  const [programAddRecipeDropdown, setProgramAddRecipeDropdown] = useState<{ programId: string, subfolderId: string | 'main' } | null>(null);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);
  const [openSubfolderId, setOpenSubfolderId] = useState<string | null>(null);
  const [programRecipeFilter, setProgramRecipeFilter] = useState<string>('Все');
  const [subfolderRecipeFilters, setSubfolderRecipeFilters] = useState<Record<string, string>>({});
  const [editingSubfolderId, setEditingSubfolderId] = useState<string | null>(null);
  const [isCreateProgramDropdownOpen, setIsCreateProgramDropdownOpen] = useState(false);
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
  const [activeAddDropdown, setActiveAddDropdown] = useState<string | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isCreatingProgram, setIsCreatingProgram] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [isProgramSelectionOpen, setIsProgramSelectionOpen] = useState(false);
  const { activeNutritionPlan, setActivePlan } = useNutritionPlan();
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
    setActiveCollectionId(null);
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
      setActiveCollectionId(programId);
    } catch (error) {
      console.error("Error adding recipes:", error);
      alert("Не удалось добавить рецепты");
    }
  };

  const [programFormData, setProgramFormData] = useState({
    name: '',
    description: '',
    creator: '',
    link: '',
    recipeIds: [] as string[],
    image: '',
    pdfUrl: '',
    subfolders: [] as Subfolder[],
    allowedProducts: [] as string[],
    forbiddenProducts: [] as string[]
  });
  const [productFormData, setProductFormData] = useState({
    name: '',
    amount: '',
    calories: 0,
    proteins: 0,
    fats: 0,
    carbs: 0
  });

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
            setActiveCollectionId(programId);
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
    const q = query(collection(db, "planner"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const entries: PlannerEntry[] = [];
      querySnapshot.forEach((doc) => {
        entries.push({ id: doc.id, ...doc.data() } as PlannerEntry);
      });
      setPlannerEntries(entries);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "programs"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const programsData: Program[] = [];
      querySnapshot.forEach((doc) => {
        programsData.push({ id: doc.id, ...doc.data() } as Program);
      });
      setPrograms(programsData);
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



  const handleAddProductToPlanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickingMealInfo || !productFormData.name) return;

    try {
      await addDoc(collection(db, "planner"), {
        date: pickingMealInfo.date,
        mealType: pickingMealInfo.mealType,
        type: 'product',
        productName: productFormData.name,
        amount: productFormData.amount,
        macros: {
          calories: productFormData.calories,
          proteins: productFormData.proteins,
          fats: productFormData.fats,
          carbs: productFormData.carbs
        }
      });
      setIsAddingProduct(false);
      setProductFormData({ name: '', amount: '', calories: 0, proteins: 0, fats: 0, carbs: 0 });
      alert("Продукт добавлен");
    } catch (error) {
      console.error("Error adding product to planner:", error);
      alert("Ошибка при добавлении продукта");
    }
  };

  const handleProgramPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProgramFormData({ ...programFormData, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProgramPdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1] ?? '';
      try {
        // Large PDFs (> ~15 MB raw) can't be sent inline — extract text on client instead
        const isLarge = base64.length > 20_000_000;
        const request = isLarge
          ? { pdfText: await extractTextFromPDF(base64), availableCategories }
          : { pdfBase64: base64, availableCategories };
        const result = await aiClient.importFromPdf(request);

        const recipeIds: string[] = [];
        for (const r of result.recipes) {
          let dishImage: string | null = null;

          if (r.pageNumber && r.dishBoundingBox) {
            const extracted = await extractImageFromPDF(base64, r.pageNumber, r.dishBoundingBox);
            if (extracted) dishImage = extracted;
          }

          if (!dishImage) {
            const generated = await aiClient.generateImage({ title: r.title, ingredients: r.ingredients });
            if (generated?.imageDataUri) dishImage = generated.imageDataUri;
          }

          const imageToStore = dishImage && dishImage.length <= 800_000 ? dishImage : null;
          const docRef = await addDoc(collection(db, "recipes"), {
            title: r.title,
            author: r.author ?? "",
            image: imageToStore,
            time: r.time,
            servings: r.servings,
            categories: r.categories,
            ingredients: r.ingredients,
            steps: r.steps,
            macros: r.macros,
            isFavorite: false,
            createdAt: new Date().toISOString(),
          });
          recipeIds.push(docRef.id);
        }

        const inferredName = file.name.replace(/\.pdf$/i, '');
        setProgramFormData(prev => ({
          ...prev,
          name: prev.name || inferredName,
          recipeIds,
          pdfUrl: file.name,
        }));

        alert(`Извлечено рецептов: ${result.recipes.length}. Проверьте название и сохраните программу.`);
      } catch (error) {
        console.error("Error analyzing PDF for program:", error);
        alert("Не удалось распознать PDF. Попробуйте другой файл.");
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubfolderPdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newResource: Resource = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'pdf',
        url: file.name, // In real app, this would be the uploaded file URL
        title: file.name,
        description: ""
      };

      if (editingEntity) {
        setEditFormData(prev => ({ ...prev, resources: [...prev.resources, newResource] }));
        alert(`Файл ${file.name} добавлен`);
        return;
      }

      if (activeResourceForm) {
        const program = programs.find(p => p.id === activeCollectionId);
        if (program) {
          if (activeResourceForm.targetId === 'main') {
            updateDoc(doc(db, "programs", program.id), {
              resources: [...(program.resources || []), newResource]
            });
          } else {
            const newSubfolders = program.subfolders?.map(sf => 
              sf.id === activeResourceForm.targetId ? { ...sf, resources: [...(sf.resources || []), newResource] } : sf
            );
            updateDoc(doc(db, "programs", program.id), { subfolders: newSubfolders });
          }
        }
        setActiveResourceForm(null);
        alert(`Файл ${file.name} загружен`);
      }
    }
  };

  const handleSubfolderPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingSubfolderId) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProgramFormData({
          ...programFormData,
          subfolders: programFormData.subfolders.map(sf => 
            sf.id === editingSubfolderId ? { ...sf, image: reader.result as string } : sf
          )
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programFormData.name) return;

    try {
      if (editingProgramId) {
        await updateDoc(doc(db, "programs", editingProgramId), {
          ...programFormData,
          updatedAt: new Date().toISOString()
        });
        alert("Программа обновлена");
      } else {
        const docRef = await addDoc(collection(db, "programs"), {
          ...programFormData,
          createdAt: new Date().toISOString()
        });
        alert("Программа создана");
      }
      setIsCreatingProgram(false);
      setEditingProgramId(null);
      setProgramFormData({ 
        name: '', 
        description: '', 
        creator: '', 
        link: '', 
        recipeIds: [], 
        image: '', 
        pdfUrl: '', 
        subfolders: [],
        allowedProducts: [],
        forbiddenProducts: []
      });
    } catch (error) {
      console.error("Error saving program:", error);
      alert("Ошибка при сохранении программы");
    }
  };

  const handleShareProgram = (programId: string) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?programId=${programId}`;
    navigator.clipboard.writeText(shareUrl);
    alert("Ссылка скопирована в буфер обмена!");
  };

  const handleAddToPlanner = async (date: string, mealType: string, recipeId: string) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (recipe) {
      const allergens = userProfile.allergies.filter(allergy =>
        recipe.ingredients.some(ing => ing.toLowerCase().includes(allergy.toLowerCase()))
      );
      if (allergens.length > 0) {
        if (!confirm(`Осторожно! Этот рецепт содержит ингредиенты, на которые у вас аллергия: ${allergens.join(', ')}. Все равно добавить?`)) {
          return;
        }
      }
    }
    try {
      await addDoc(collection(db, "planner"), {
        date,
        mealType,
        type: 'recipe',
        recipeId,
      });
    } catch (error) {
      console.error("Error adding to planner:", error);
    }
  };

  const handleRemoveFromPlanner = async (entryId: string) => {
    try {
      await deleteDoc(doc(db, "planner", entryId));
    } catch (error) {
      console.error("Error removing from planner:", error);
    }
  };

  const handleDropRecipe = async (recipeId: string, targetSubfolderId: string, sourceSubfolderId: string, programId: string) => {
    if (targetSubfolderId === sourceSubfolderId) return;

    const program = programs.find(p => p.id === programId);
    if (!program) return;

    let newRecipeIds = [...program.recipeIds];
    let newSubfolders = program.subfolders ? [...program.subfolders] : [];

    // Remove from source
    if (sourceSubfolderId === 'main') {
      newRecipeIds = newRecipeIds.filter(id => id !== recipeId);
    } else {
      newSubfolders = newSubfolders.map(sf => 
        sf.id === sourceSubfolderId ? { ...sf, recipeIds: sf.recipeIds.filter(id => id !== recipeId) } : sf
      );
    }

    // Add to target
    if (targetSubfolderId === 'main') {
      if (!newRecipeIds.includes(recipeId)) newRecipeIds.push(recipeId);
    } else {
      newSubfolders = newSubfolders.map(sf => 
        sf.id === targetSubfolderId ? { ...sf, recipeIds: [...sf.recipeIds, recipeId] } : sf
      );
    }

    try {
      await updateDoc(doc(db, "programs", programId), {
        recipeIds: newRecipeIds,
        subfolders: newSubfolders
      });
    } catch (error) {
      console.error("Error moving recipe:", error);
    }
  };

  const renderPlanner = () => {
    const getEntriesForDate = (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return plannerEntries.filter(e => e.date === dateStr);
    };

    const getRecipeById = (id: string | undefined) => (id ? recipes.find(r => r.id === id) : undefined);

    const getMacrosForDate = (date: Date) => {
      const entries = getEntriesForDate(date);
      return entries.reduce((acc, entry) => {
        if (entry.type === 'recipe' && entry.recipeId) {
          const recipe = getRecipeById(entry.recipeId);
          if (recipe) {
            acc.calories += recipe.macros.calories;
            acc.proteins += recipe.macros.proteins;
            acc.fats += recipe.macros.fats;
            acc.carbs += recipe.macros.carbs;
          }
        } else if (entry.type === 'product' && entry.macros) {
          acc.calories += entry.macros.calories;
          acc.proteins += entry.macros.proteins;
          acc.fats += entry.macros.fats;
          acc.carbs += entry.macros.carbs;
        }
        return acc;
      }, { calories: 0, proteins: 0, fats: 0, carbs: 0 });
    };

    const selectedDateMacros = getMacrosForDate(selectedPlannerDate);
    const isSelectedDateOverLimit = selectedDateMacros.calories > userProfile.targetCalories || 
                                   selectedDateMacros.proteins > userProfile.targetProteins || 
                                   selectedDateMacros.fats > userProfile.targetFats || 
                                   selectedDateMacros.carbs > userProfile.targetCarbs;

    const renderDayView = () => {
      const entries = getEntriesForDate(selectedPlannerDate);
      const totalMacros = selectedDateMacros;

      return (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-zinc-100 p-5 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedPlannerDate(subDays(selectedPlannerDate, 1))}
                className="p-2 hover:bg-zinc-50 rounded-xl transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-zinc-400" />
              </button>
              <div className="text-center min-w-[140px]">
                <h3 className="font-bold text-lg">{format(selectedPlannerDate, 'd MMMM', { locale: ru })}</h3>
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">{format(selectedPlannerDate, 'EEEE', { locale: ru })}</p>
              </div>
              <button 
                onClick={() => setSelectedPlannerDate(addDays(selectedPlannerDate, 1))}
                className="p-2 hover:bg-zinc-50 rounded-xl transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <div className="flex gap-2">
              <div className={cn(
                "text-center p-2 rounded-xl min-w-[50px] border transition-colors",
                totalMacros.calories > userProfile.targetCalories ? "bg-red-50 border-red-100" : "bg-zinc-50 border-zinc-100"
              )}>
                <p className="text-[8px] font-bold text-zinc-400 uppercase">Ккал</p>
                <p className={cn("font-bold text-xs", totalMacros.calories > userProfile.targetCalories ? "text-red-600" : "text-emerald-600")}>
                  {totalMacros.calories}
                </p>
              </div>
              <div className={cn(
                "text-center p-2 rounded-xl min-w-[40px] border transition-colors",
                totalMacros.proteins > userProfile.targetProteins ? "bg-red-50 border-red-100" : "bg-zinc-50 border-zinc-100"
              )}>
                <p className="text-[8px] font-bold text-zinc-400 uppercase">Б</p>
                <p className={cn("font-bold text-xs", totalMacros.proteins > userProfile.targetProteins ? "text-red-600" : "text-zinc-700")}>
                  {totalMacros.proteins}г
                </p>
              </div>
              <div className={cn(
                "text-center p-2 rounded-xl min-w-[40px] border transition-colors",
                totalMacros.fats > userProfile.targetFats ? "bg-red-50 border-red-100" : "bg-zinc-50 border-zinc-100"
              )}>
                <p className="text-[8px] font-bold text-zinc-400 uppercase">Ж</p>
                <p className={cn("font-bold text-xs", totalMacros.fats > userProfile.targetFats ? "text-red-600" : "text-zinc-700")}>
                  {totalMacros.fats}г
                </p>
              </div>
              <div className={cn(
                "text-center p-2 rounded-xl min-w-[40px] border transition-colors",
                totalMacros.carbs > userProfile.targetCarbs ? "bg-red-50 border-red-100" : "bg-zinc-50 border-zinc-100"
              )}>
                <p className="text-[8px] font-bold text-zinc-400 uppercase">У</p>
                <p className={cn("font-bold text-xs", totalMacros.carbs > userProfile.targetCarbs ? "text-red-600" : "text-zinc-700")}>
                  {totalMacros.carbs}г
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {mealTypes.map(meal => {
              const mealEntries = entries.filter(e => e.mealType === meal);
              const mealMacros = mealEntries.reduce((acc, entry) => {
                if (entry.type === 'recipe' && entry.recipeId) {
                  const recipe = getRecipeById(entry.recipeId);
                  if (recipe) {
                    acc.calories += recipe.macros.calories;
                    acc.proteins += recipe.macros.proteins;
                    acc.fats += recipe.macros.fats;
                    acc.carbs += recipe.macros.carbs;
                  }
                } else if (entry.type === 'product' && entry.macros) {
                  acc.calories += entry.macros.calories;
                  acc.proteins += entry.macros.proteins;
                  acc.fats += entry.macros.fats;
                  acc.carbs += entry.macros.carbs;
                }
                return acc;
              }, { calories: 0, proteins: 0, fats: 0, carbs: 0 });

              return (
                <div key={meal} className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                  <div className="p-3 sm:p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                      {meal[0]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{meal}</h4>
                      </div>
                      <div className="space-y-2">
                        {mealEntries.map(entry => {
                          if (entry.type === 'recipe' && entry.recipeId) {
                            const recipe = getRecipeById(entry.recipeId);
                            if (!recipe) return null;
                            return (
                              <div key={entry.id} className="flex items-center justify-between group/item">
                                <button 
                                  onClick={() => setSelectedRecipe(recipe)}
                                  className="font-bold text-zinc-900 hover:text-emerald-600 transition-colors text-xs"
                                >
                                  {recipe.title}
                                </button>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-bold text-emerald-600">{recipe.macros.calories} ккал</span>
                                  <button 
                                    onClick={() => handleRemoveFromPlanner(entry.id)}
                                    className="p-1 text-zinc-300 hover:text-red-500 transition-colors opacity-0 group-hover/item:opacity-100"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          } else if (entry.type === 'product') {
                            return (
                              <div key={entry.id} className="flex items-center justify-between group/item">
                                <div className="flex flex-col">
                                  <span className="font-bold text-zinc-900 text-xs">{entry.productName}</span>
                                  {entry.amount && <span className="text-[9px] text-zinc-400 font-medium uppercase">{entry.amount}</span>}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-bold text-emerald-600">{entry.macros?.calories} ккал</span>
                                  <button 
                                    onClick={() => handleRemoveFromPlanner(entry.id)}
                                    className="p-1 text-zinc-300 hover:text-red-500 transition-colors opacity-0 group-hover/item:opacity-100"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })}
                        <div className="relative inline-block">
                          <button 
                            onClick={() => setActiveAddDropdown(activeAddDropdown === `${meal}` ? null : `${meal}`)}
                            className="text-[10px] text-zinc-400 hover:text-emerald-600 transition-colors flex items-center gap-1.5 font-bold"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Добавить</span>
                          </button>
                          
                          <AnimatePresence>
                            {activeAddDropdown === `${meal}` && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setActiveAddDropdown(null)} />
                                <motion.div 
                                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                  className="absolute left-0 mt-2 w-40 bg-white rounded-xl shadow-2xl border border-zinc-100 overflow-hidden z-20"
                                >
                                  <button 
                                    onClick={() => {
                                      setPickingMealInfo({ date: format(selectedPlannerDate, 'yyyy-MM-dd'), mealType: meal });
                                      setIsRecipePickerOpen(true);
                                      setActiveAddDropdown(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-2 border-b border-zinc-50"
                                  >
                                    <ChefHat className="w-3.5 h-3.5 text-emerald-500" /> Рецепт
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setPickingMealInfo({ date: format(selectedPlannerDate, 'yyyy-MM-dd'), mealType: meal });
                                      setIsAddingProduct(true);
                                      setActiveAddDropdown(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                                  >
                                    <ShoppingCart className="w-3.5 h-3.5 text-emerald-500" /> Продукт
                                  </button>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                        
                        {mealEntries.length > 0 && (
                          <div className="pt-2 mt-2 border-t border-zinc-50 flex items-center justify-between text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                            <span>Итого:</span>
                            <div className="flex gap-2.5">
                              <span className="text-emerald-600">{mealMacros.calories} ккал</span>
                              <span>Б: {mealMacros.proteins}г</span>
                              <span>Ж: {mealMacros.fats}г</span>
                              <span>У: {mealMacros.carbs}г</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            <div className={cn(
              "mt-4 p-5 rounded-3xl text-white shadow-lg flex items-center justify-between transition-colors",
              isSelectedDateOverLimit ? "bg-red-500 shadow-red-100" : "bg-emerald-600 shadow-emerald-100"
            )}>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-0.5">Итого за день</h4>
                <p className="text-xl font-bold">{totalMacros.calories} ккал</p>
              </div>
              <div className="flex gap-4 text-xs font-bold">
                <div className="text-center">
                  <p className="opacity-70 uppercase text-[9px] mb-0.5">Белки</p>
                  <p className={cn(totalMacros.proteins > userProfile.targetProteins && "text-red-100 underline decoration-2 underline-offset-4")}>{totalMacros.proteins}г</p>
                </div>
                <div className="text-center">
                  <p className="opacity-70 uppercase text-[9px] mb-0.5">Жиры</p>
                  <p className={cn(totalMacros.fats > userProfile.targetFats && "text-red-100 underline decoration-2 underline-offset-4")}>{totalMacros.fats}г</p>
                </div>
                <div className="text-center">
                  <p className="opacity-70 uppercase text-[9px] mb-0.5">Углеводы</p>
                  <p className={cn(totalMacros.carbs > userProfile.targetCarbs && "text-red-100 underline decoration-2 underline-offset-4")}>{totalMacros.carbs}г</p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                const newMeal = prompt("Введите название приема пищи:");
                if (newMeal && !mealTypes.includes(newMeal)) {
                  setMealTypes([...mealTypes, newMeal]);
                }
              }}
              className="py-4 border-2 border-dashed border-zinc-200 rounded-3xl text-zinc-400 font-bold hover:border-emerald-300 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Добавить прием пищи
            </button>
          </div>
        </div>
      );
    };

    const renderWeekView = () => {
      const start = startOfWeek(selectedPlannerDate, { weekStartsOn: 1 });
      const end = endOfWeek(selectedPlannerDate, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start, end });

      return (
        <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-8 border-b border-zinc-100">
            {days.map(day => (
              <div key={day.toString()} className={cn(
                "p-4 text-center border-r border-zinc-100 last:border-r-0",
                isToday(day) ? "bg-emerald-50/30" : ""
              )}>
                <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">{format(day, 'EEE', { locale: ru })}</p>
                <p className={cn("font-bold", isToday(day) ? "text-emerald-600" : "text-zinc-900")}>{format(day, 'd')}</p>
              </div>
            ))}
            <div className="p-4 border-l border-zinc-100 bg-zinc-50/50" />
          </div>
          {mealTypes.map(meal => (
            <div key={meal} className="grid grid-cols-8 border-b border-zinc-100 last:border-b-0">
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayMealEntries = plannerEntries.filter(e => e.date === dateStr && e.mealType === meal);
                const cellMacros = dayMealEntries.reduce((acc, entry) => {
                  if (entry.type === 'recipe' && entry.recipeId) {
                    const recipe = getRecipeById(entry.recipeId);
                    if (recipe) {
                      acc.calories += recipe.macros.calories;
                      acc.proteins += recipe.macros.proteins;
                      acc.fats += recipe.macros.fats;
                      acc.carbs += recipe.macros.carbs;
                    }
                  } else if (entry.type === 'product' && entry.macros) {
                    acc.calories += entry.macros.calories;
                    acc.proteins += entry.macros.proteins;
                    acc.fats += entry.macros.fats;
                    acc.carbs += entry.macros.carbs;
                  }
                  return acc;
                }, { calories: 0, proteins: 0, fats: 0, carbs: 0 });

                return (
                  <div key={day.toString() + meal} className="p-1.5 border-r border-zinc-100 last:border-r-0 min-h-[100px] group relative flex flex-col gap-1.5">
                    {dayMealEntries.map(entry => {
                      if (entry.type === 'recipe' && entry.recipeId) {
                        const recipe = getRecipeById(entry.recipeId);
                        if (!recipe) return null;
                        return (
                          <div key={entry.id} className="p-1.5 bg-emerald-50/50 rounded-lg border border-emerald-100/50 group/item">
                            <button 
                              onClick={() => setSelectedRecipe(recipe)}
                              className="text-[9px] font-bold text-zinc-900 leading-tight line-clamp-2 hover:text-emerald-600 text-left w-full"
                            >
                              {recipe.title}
                            </button>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[8px] font-bold text-emerald-600">{recipe.macros.calories}</span>
                              <button 
                                onClick={() => handleRemoveFromPlanner(entry.id)}
                                className="text-zinc-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        );
                      } else if (entry.type === 'product') {
                        return (
                          <div key={entry.id} className="p-1.5 bg-zinc-50 rounded-lg border border-zinc-100 group/item">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[9px] font-bold text-zinc-900 leading-tight line-clamp-2">{entry.productName}</span>
                              {entry.amount && <span className="text-[7px] text-zinc-400 font-bold uppercase">{entry.amount}</span>}
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[8px] font-bold text-emerald-600">{entry.macros?.calories}</span>
                              <button 
                                onClick={() => handleRemoveFromPlanner(entry.id)}
                                className="text-zinc-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                    
                    {dayMealEntries.length > 0 && (
                      <div className="mt-auto pt-1.5 border-t border-zinc-50 flex flex-col gap-0.5 text-[7px] font-bold text-zinc-400 uppercase">
                        <div className="flex justify-between text-emerald-600">
                          <span>Ккал</span>
                          <span>{cellMacros.calories}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Б/Ж/У</span>
                          <span>{cellMacros.proteins}/{cellMacros.fats}/{cellMacros.carbs}</span>
                        </div>
                      </div>
                    )}

                    <div className="relative mt-auto">
                      <button 
                        onClick={() => setActiveAddDropdown(activeAddDropdown === `${dateStr}-${meal}` ? null : `${dateStr}-${meal}`)}
                        className="w-full h-8 rounded-lg border border-dashed border-zinc-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all flex items-center justify-center text-zinc-200 hover:text-emerald-400"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      
                      <AnimatePresence>
                        {activeAddDropdown === `${dateStr}-${meal}` && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setActiveAddDropdown(null)} />
                            <motion.div 
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute bottom-full left-0 mb-2 w-32 bg-white rounded-xl shadow-2xl border border-zinc-100 overflow-hidden z-20"
                            >
                              <button 
                                onClick={() => {
                                  setPickingMealInfo({ date: dateStr, mealType: meal });
                                  setIsRecipePickerOpen(true);
                                  setActiveAddDropdown(null);
                                }}
                                className="w-full px-3 py-2 text-left text-[10px] font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-2 border-b border-zinc-50"
                              >
                                <ChefHat className="w-3 h-3 text-emerald-500" /> Рецепт
                              </button>
                              <button 
                                onClick={() => {
                                  setPickingMealInfo({ date: dateStr, mealType: meal });
                                  setIsAddingProduct(true);
                                  setActiveAddDropdown(null);
                                }}
                                className="w-full px-3 py-2 text-left text-[10px] font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                              >
                                <ShoppingCart className="w-3 h-3 text-emerald-500" /> Продукт
                              </button>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
              <div className="p-4 border-l border-zinc-100 bg-zinc-50/50 flex items-center justify-center">
                {/* Empty column as requested */}
              </div>
            </div>
          ))}
          
          <div className="grid grid-cols-8 bg-zinc-50/50 border-t border-zinc-100">
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayEntries = plannerEntries.filter(e => e.date === dateStr);
              const dayTotalMacros = dayEntries.reduce((acc, entry) => {
                if (entry.type === 'recipe' && entry.recipeId) {
                  const recipe = getRecipeById(entry.recipeId);
                  if (recipe) {
                    acc.calories += recipe.macros.calories;
                    acc.proteins += recipe.macros.proteins;
                    acc.fats += recipe.macros.fats;
                    acc.carbs += recipe.macros.carbs;
                  }
                } else if (entry.type === 'product' && entry.macros) {
                  acc.calories += entry.macros.calories;
                  acc.proteins += entry.macros.proteins;
                  acc.fats += entry.macros.fats;
                  acc.carbs += entry.macros.carbs;
                }
                return acc;
              }, { calories: 0, proteins: 0, fats: 0, carbs: 0 });

              return (
                <div key={day.toString() + 'total'} className="p-2 text-center border-r border-zinc-100 last:border-r-0">
                  <p className="text-[8px] font-bold text-zinc-400 uppercase mb-0.5">Итого</p>
                  <div className={cn(
                    "p-1.5 rounded-lg border transition-colors",
                    dayTotalMacros.calories > userProfile.targetCalories ? "bg-red-50 border-red-100" : "bg-zinc-50/50 border-zinc-100"
                  )}>
                    <p className={cn(
                      "text-[10px] font-bold mb-0.5",
                      dayTotalMacros.calories > userProfile.targetCalories ? "text-red-600" : "text-emerald-600"
                    )}>
                      {dayTotalMacros.calories} ккал
                    </p>
                    <p className="text-[7px] font-bold text-zinc-500">
                      <span className={cn(dayTotalMacros.proteins > userProfile.targetProteins && "text-red-600")}>{dayTotalMacros.proteins}</span> / 
                      <span className={cn(dayTotalMacros.fats > userProfile.targetFats && "text-red-600")}>{dayTotalMacros.fats}</span> / 
                      <span className={cn(dayTotalMacros.carbs > userProfile.targetCarbs && "text-red-600")}>{dayTotalMacros.carbs}</span>
                    </p>
                  </div>
                </div>
              );
            })}
            <div className="p-3 border-l border-zinc-100 flex items-center justify-center">
              <span className="text-[8px] font-bold text-zinc-400 uppercase">Всего</span>
            </div>
          </div>
        </div>
      );
    };

    const renderMonthView = () => {
      const start = startOfMonth(selectedPlannerDate);
      const end = endOfMonth(selectedPlannerDate);
      const monthStart = startOfWeek(start, { weekStartsOn: 1 });
      const monthEnd = endOfWeek(end, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

      return (
        <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-zinc-100 bg-zinc-50/50">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
              <div key={d} className="p-3 text-center text-[10px] font-bold text-zinc-400 uppercase">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const entries = plannerEntries.filter(e => e.date === dateStr);
              const totalCals = entries.reduce((sum, e) => sum + (getRecipeById(e.recipeId)?.macros.calories || 0), 0);
              const isCurrentMonth = day.getMonth() === selectedPlannerDate.getMonth();

              return (
                <div 
                  key={day.toString()} 
                  onClick={() => {
                    setSelectedPlannerDate(day);
                    setPlannerViewScale('day');
                  }}
                  className={cn(
                    "p-2 border-r border-b border-zinc-100 aspect-square cursor-pointer hover:bg-zinc-50 transition-colors group",
                    !isCurrentMonth && "opacity-30"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={cn(
                      "text-xs font-bold",
                      isToday(day) ? "w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center" : "text-zinc-400"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {totalCals > 0 && (
                      <span className="text-[9px] font-bold text-emerald-600">{totalCals}</span>
                    )}
                  </div>
                  <div className="flex gap-0.5 mt-auto">
                    {mealTypes.map(meal => {
                      const hasMeal = entries.some(e => e.mealType === meal);
                      return (
                        <div key={meal} className={cn(
                          "flex-1 h-1 rounded-full",
                          hasMeal ? "bg-emerald-400" : "bg-zinc-100"
                        )} />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    const renderListView = () => {
      const start = startOfWeek(selectedPlannerDate, { weekStartsOn: 1 });
      const end = endOfWeek(selectedPlannerDate, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start, end });

      return (
        <div className="space-y-8">
          {days.map(day => {
            const entries = getEntriesForDate(day);
            if (entries.length === 0) return null;

            return (
              <div key={day.toString()} className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                    {format(day, 'd')}
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900">{format(day, 'EEEE', { locale: ru })}</h3>
                    <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">{format(day, 'd MMMM', { locale: ru })}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {mealTypes.map(meal => {
                    const mealEntries = entries.filter(e => e.mealType === meal);
                    if (mealEntries.length === 0) return null;

                    return (
                      <div key={meal} className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm hover:shadow-md transition-all space-y-3">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase mb-2">{meal}</p>
                        {mealEntries.map(entry => {
                          const recipe = getRecipeById(entry.recipeId);
                          if (!recipe) return null;
                          return (
                            <div key={entry.id} className="space-y-1">
                              <button 
                                onClick={() => setSelectedRecipe(recipe)}
                                className="font-bold text-zinc-900 hover:text-emerald-600 transition-colors text-sm line-clamp-2 mb-1 w-full text-left"
                              >
                                {recipe.title}
                              </button>
                              <div className="flex items-center justify-between text-[10px] font-bold text-emerald-600">
                                <span>{recipe.macros.calories} ккал</span>
                                <button 
                                  onClick={() => handleRemoveFromPlanner(entry.id)}
                                  className="text-zinc-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {days.every(day => getEntriesForDate(day).length === 0) && (
            <div className="py-20 text-center space-y-4 bg-white rounded-3xl border border-dashed border-zinc-200">
              <Calendar className="w-12 h-12 text-zinc-200 mx-auto" />
              <p className="text-zinc-400">На эту неделю ничего не запланировано</p>
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="max-w-6xl mx-auto space-y-8 pb-24">
        {isSelectedDateOverLimit && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500 text-white p-4 rounded-3xl flex items-center gap-4 shadow-lg shadow-red-100"
          >
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <p className="font-bold uppercase tracking-widest text-sm">Вы превышаете норму, допустимую программой</p>
          </motion.div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold font-display mb-2">
              Дорогая (ой) {userProfile.name || '(Имя)'} составь твой твой идеальный план рациона тут
            </h2>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl">
              <button 
                onClick={() => setPlannerViewMode('calendar')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  plannerViewMode === 'calendar' ? "bg-white shadow-sm text-emerald-600" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                <Calendar className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setPlannerViewMode('list')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  plannerViewMode === 'list' ? "bg-white shadow-sm text-emerald-600" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                <List className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3 bg-zinc-100 p-1.5 rounded-2xl self-start">
              {(['day', 'week', 'month'] as PlannerViewScale[]).map(scale => (
                <button 
                  key={scale}
                  onClick={() => setPlannerViewScale(scale)}
                  className={cn(
                    "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                    plannerViewScale === scale ? "bg-white shadow-sm text-emerald-600" : "text-zinc-500 hover:text-zinc-700"
                  )}
                >
                  {scale === 'day' ? 'День' : scale === 'week' ? 'Неделя' : 'Месяц'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {plannerViewScale === 'month' ? (
              <div className="flex items-center gap-4">
                <button onClick={() => setSelectedPlannerDate(subMonths(selectedPlannerDate, 1))} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                <h3 className="font-bold text-xl min-w-[140px] text-center capitalize">{format(selectedPlannerDate, 'LLLL yyyy', { locale: ru })}</h3>
                <button onClick={() => setSelectedPlannerDate(addMonths(selectedPlannerDate, 1))} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"><ChevronRight className="w-5 h-5" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <button onClick={() => setSelectedPlannerDate(subDays(selectedPlannerDate, plannerViewScale === 'week' ? 7 : 1))} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                <h3 className="font-bold text-xl min-w-[200px] text-center">
                  {plannerViewScale === 'week' 
                    ? `${format(startOfWeek(selectedPlannerDate, { weekStartsOn: 1 }), 'd MMM')} — ${format(endOfWeek(selectedPlannerDate, { weekStartsOn: 1 }), 'd MMM')}`
                    : format(selectedPlannerDate, 'd MMMM', { locale: ru })
                  }
                </h3>
                <button onClick={() => setSelectedPlannerDate(addDays(selectedPlannerDate, plannerViewScale === 'week' ? 7 : 1))} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"><ChevronRight className="w-5 h-5" /></button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={async () => {
                const entries = plannerViewScale === 'day' 
                  ? getEntriesForDate(selectedPlannerDate)
                  : plannerEntries.filter(e => {
                      const d = parseISO(e.date);
                      const start = startOfWeek(selectedPlannerDate, { weekStartsOn: 1 });
                      const end = endOfWeek(selectedPlannerDate, { weekStartsOn: 1 });
                      return d >= start && d <= end;
                    });
                
                const ingredientMap: Record<string, { amount: string, dishes: Set<string>, isBasic: boolean }> = {};

                entries.forEach(e => {
                  const recipe = getRecipeById(e.recipeId);
                  if (recipe) {
                    recipe.ingredients.forEach(ing => {
                      const isBasic = isStaple(ing);
                      const lowerIng = ing.toLowerCase();

                      // Try to find if we already have this ingredient (very basic fuzzy match)
                      let key = ing;
                      const existingKey = Object.keys(ingredientMap).find(k =>
                        k.toLowerCase().includes(lowerIng) || lowerIng.includes(k.toLowerCase())
                      );
                      if (existingKey) key = existingKey;

                      let entry = ingredientMap[key];
                      if (!entry) {
                        entry = { amount: '', dishes: new Set(), isBasic };
                        ingredientMap[key] = entry;
                      }

                      entry.dishes.add(recipe.title);

                      // Simple amount extraction and summing attempt
                      const amountMatch = ing.match(/^([\d.,/]+(?:\s*[г|кг|мл|л|шт|ст\.л|ч\.л|зубчик|щепотка|пучок|банка|упаковка])?)/i);
                      if (amountMatch) {
                        const newAmount = (amountMatch[1] ?? '').trim();
                        if (!entry.amount) {
                          entry.amount = newAmount;
                        } else {
                          const currentVal = parseFloat(entry.amount.replace(',', '.'));
                          const newVal = parseFloat(newAmount.replace(',', '.'));
                          const currentUnit = entry.amount.replace(/[\d.,/\s]/g, '');
                          const newUnit = newAmount.replace(/[\d.,/\s]/g, '');

                          if (!isNaN(currentVal) && !isNaN(newVal) && currentUnit === newUnit) {
                            entry.amount = (currentVal + newVal) + currentUnit;
                          } else {
                            entry.amount += `, ${newAmount}`;
                          }
                        }
                        // Remove amount from name if it was at the start
                        if (key === ing) {
                          const nameOnly = ing.replace(amountMatch[0], '').trim();
                          if (nameOnly) {
                            delete ingredientMap[key];
                            key = nameOnly;
                            const existing = ingredientMap[key];
                            if (!existing) {
                              ingredientMap[key] = { amount: newAmount, dishes: new Set([recipe.title]), isBasic };
                            } else {
                              existing.dishes.add(recipe.title);
                            }
                          }
                        }
                      }
                    });
                  }
                });

                for (const [name, info] of Object.entries(ingredientMap)) {
                  await addDoc(collection(db, "cart"), {
                    name,
                    amount: info.amount || 'по вкусу',
                    sourceDishes: Array.from(info.dishes),
                    checked: false,
                    isBasic: info.isBasic,
                    createdAt: new Date().toISOString()
                  });
                }
                
                setActiveTab('cart');
                alert(`Добавлено ${Object.keys(ingredientMap).length} ингредиентов в корзину`);
              }}
              className="flex items-center gap-2 bg-white border border-zinc-200 px-5 py-2.5 rounded-2xl text-zinc-600 font-bold hover:bg-zinc-50 transition-all shadow-sm"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>Список покупок</span>
            </button>
          </div>
        </div>

        {plannerViewMode === 'calendar' ? (
          <>
            {plannerViewScale === 'day' && renderDayView()}
            {plannerViewScale === 'week' && renderWeekView()}
            {plannerViewScale === 'month' && renderMonthView()}
          </>
        ) : (
          renderListView()
        )}
      </div>
    );
  };



  const renderPrograms = () => {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-zinc-900">Программы</h2>
            <p className="text-zinc-500 mt-1">Создавайте и делитесь своими коллекциями рецептов</p>
          </div>
          <div className="flex items-center gap-4">
            <select 
              value={programRecipeFilter}
              onChange={(e) => setProgramRecipeFilter(e.target.value)}
              className="text-xs font-bold text-emerald-600 bg-emerald-50 border-none rounded-lg px-4 py-2.5 outline-none"
            >
              <option value="Все">Все категории</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="relative">
              <button 
                onClick={() => setIsCreateProgramDropdownOpen(!isCreateProgramDropdownOpen)}
                className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span>Создать папку</span>
              </button>

            <AnimatePresence>
              {isCreateProgramDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsCreateProgramDropdownOpen(false)}
                  />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden z-50"
                  >
                    <AddRecipeOption 
                      icon={<Edit3 className="w-4 h-4 text-emerald-500" />} 
                      label="Создать вручную" 
                      onClick={() => {
                        setEditingProgramId(null);
                        setProgramFormData({ 
                          name: '', 
                          description: '', 
                          creator: '', 
                          link: '', 
                          recipeIds: [], 
                          image: '', 
                          pdfUrl: '', 
                          subfolders: [],
                          allowedProducts: [],
                          forbiddenProducts: []
                        });
                        setIsCreatingProgram(true);
                        setIsCreateProgramDropdownOpen(false);
                      }}
                    />
                    <AddRecipeOption 
                      icon={<FileText className="w-4 h-4 text-emerald-500" />} 
                      label="Загрузить PDF" 
                      onClick={() => {
                        setEditingProgramId(null);
                        setProgramFormData({ 
                          name: '', 
                          description: '', 
                          creator: '', 
                          link: '', 
                          recipeIds: [], 
                          image: '', 
                          pdfUrl: '', 
                          subfolders: [],
                          allowedProducts: [],
                          forbiddenProducts: []
                        });
                        setIsCreatingProgram(true);
                        setIsCreateProgramDropdownOpen(false);
                        setTimeout(() => programPdfInputRef.current?.click(), 100);
                      }}
                    />
                  </motion.div>
                </>
              )}
            </AnimatePresence>
            </div>
          </div>
        </div>

        {programs.length === 0 ? (
          <div className="bg-white rounded-3xl border border-zinc-100 p-12 text-center">
            <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-10 h-10 text-zinc-300" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">У вас пока нет программ</h3>
            <p className="text-zinc-500 max-w-sm mx-auto">
              Создайте свою первую программу, добавьте в нее рецепты и поделитесь с друзьями.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs
              .filter(p => 
                programRecipeFilter === 'Все' || 
                recipes.some(r => p.recipeIds.includes(r.id) && r.categories.includes(programRecipeFilter)) ||
                (p.subfolders && p.subfolders.some(sf => recipes.some(r => sf.recipeIds.includes(r.id) && r.categories.includes(programRecipeFilter))))
              )
              .map(program => (
              <div key={program.id} 
                onClick={() => setActiveCollectionId(program.id)}
                className="bg-white rounded-3xl border border-zinc-100 overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col cursor-pointer"
              >
                {program.image && (
                  <div className="aspect-video w-full overflow-hidden">
                    <img 
                      src={program.image} 
                      alt={program.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <FolderPlus className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProgramId(program.id);
                          setProgramFormData({
                            name: program.name,
                            description: program.description,
                            creator: program.creator,
                            link: program.link,
                            recipeIds: program.recipeIds,
                            image: program.image || '',
                            pdfUrl: program.pdfUrl || '',
                            subfolders: program.subfolders || [],
                            allowedProducts: program.allowedProducts || [],
                            forbiddenProducts: program.forbiddenProducts || []
                          });
                          setIsCreatingProgram(true);
                        }}
                        className="p-2 text-zinc-400 hover:text-emerald-600 transition-colors"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setProgramToDelete(program);
                        }}
                        className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShareProgram(program.id);
                        }}
                        className="p-2 text-zinc-400 hover:text-emerald-600 transition-colors"
                      >
                        <Share2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900 mb-1">{program.name}</h3>
                  <p className="text-sm text-zinc-500 mb-4 line-clamp-2">{program.description}</p>
                  
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase">
                      <Users className="w-3.5 h-3.5" />
                      <span>Автор: {program.creator}</span>
                    </div>
                    {program.link && (
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase">
                        <LinkIcon className="w-3.5 h-3.5" />
                        <a 
                          href={program.link.startsWith('http') ? program.link : `https://${program.link}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-emerald-600 hover:underline truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {program.link}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto pt-4 border-t border-zinc-50 flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-400 uppercase">{program.recipeIds.length} рецептов</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm("Удалить эту программу?")) {
                            await deleteDoc(doc(db, "programs", program.id));
                          }
                        }}
                        className="p-2 text-zinc-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Program Modal */}
        <AnimatePresence>
          {isCreatingProgram && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCreatingProgram(false)}
                className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden p-8 max-h-[90vh] overflow-y-auto custom-scrollbar"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold">{editingProgramId ? 'Редактировать папку' : 'Создать папку с рецептами'}</h3>
                  <button onClick={() => setIsCreatingProgram(false)} className="text-zinc-400 hover:text-zinc-600">
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>

                <form onSubmit={handleCreateProgram} className="space-y-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase">Фото обложки</label>
                        <input 
                          type="file" 
                          ref={programPhotoInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleProgramPhotoUpload} 
                        />
                        <input 
                          type="file" 
                          ref={subfolderPhotoInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleSubfolderPhotoUpload} 
                        />
                        <div 
                          onClick={() => programPhotoInputRef.current?.click()}
                          className="w-full aspect-video bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50 transition-all overflow-hidden relative group"
                        >
                          {programFormData.image ? (
                            <>
                              <img src={programFormData.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Camera className="w-8 h-8 text-white" />
                              </div>
                            </>
                          ) : (
                            <>
                              <Camera className="w-8 h-8 text-zinc-300 mb-2" />
                              <span className="text-[10px] font-bold text-zinc-400 uppercase">Добавить фото</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase">PDF Документ</label>
                        <input 
                          type="file" 
                          ref={programPdfInputRef} 
                          className="hidden" 
                          accept="application/pdf" 
                          onChange={handleProgramPdfUpload} 
                        />
                        <div 
                          onClick={() => programPdfInputRef.current?.click()}
                          className="w-full aspect-video bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50 transition-all overflow-hidden relative group"
                        >
                          {programFormData.pdfUrl ? (
                            <div className="flex flex-col items-center gap-2 p-4 text-center">
                              <FileText className="w-8 h-8 text-emerald-600" />
                              <span className="text-[10px] font-bold text-emerald-600 truncate w-full">{programFormData.pdfUrl}</span>
                            </div>
                          ) : (
                            <>
                              <FileText className="w-8 h-8 text-zinc-300 mb-2" />
                              <span className="text-[10px] font-bold text-zinc-400 uppercase">Добавить PDF</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1">Название папки *</label>
                      <input 
                        required
                        type="text" 
                        value={programFormData.name}
                        onChange={(e) => setProgramFormData({...programFormData, name: e.target.value})}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-sm"
                        placeholder="Например: Полезные завтраки"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1">Описание</label>
                      <textarea 
                        value={programFormData.description}
                        onChange={(e) => setProgramFormData({...programFormData, description: e.target.value})}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium min-h-[80px] text-sm"
                        placeholder="О чем эта подборка?"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-zinc-700 mb-1 text-xs">Имя создателя</label>
                        <input 
                          type="text" 
                          value={programFormData.creator}
                          onChange={(e) => setProgramFormData({...programFormData, creator: e.target.value})}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-sm"
                          placeholder="Ваше имя"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-zinc-700 mb-1 text-xs">Ссылка</label>
                        <input 
                          type="text" 
                          value={programFormData.link}
                          onChange={(e) => setProgramFormData({...programFormData, link: e.target.value})}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-sm"
                          placeholder="https://..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-zinc-700 mb-1">Разрешенные продукты</label>
                        <input 
                          type="text"
                          value={programFormData.allowedProducts?.join(', ') || ''}
                          onChange={(e) => setProgramFormData({...programFormData, allowedProducts: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '')})}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-sm"
                          placeholder="Курица, Рис..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-zinc-700 mb-1">Запрещенные продукты</label>
                        <input 
                          type="text"
                          value={programFormData.forbiddenProducts?.join(', ') || ''}
                          onChange={(e) => setProgramFormData({...programFormData, forbiddenProducts: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '')})}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-sm"
                          placeholder="Сахар, Мука..."
                        />
                      </div>
                    </div>

                    {/* Subfolders Section */}
                    <div className="space-y-4 pt-4 border-t border-zinc-100">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-bold text-zinc-700 uppercase tracking-wider">Подпапки ({programFormData.subfolders.length})</label>
                        <button 
                          type="button"
                          onClick={() => {
                            const newSubfolder: Subfolder = {
                              id: Math.random().toString(36).substr(2, 9),
                              name: '',
                              description: '',
                              recipeIds: []
                            };
                            setProgramFormData({
                              ...programFormData,
                              subfolders: [...programFormData.subfolders, newSubfolder]
                            });
                          }}
                          className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Создать подпапку</span>
                        </button>
                      </div>

                      <div className="space-y-6">
                        {programFormData.subfolders.map((subfolder) => (
                          <div key={subfolder.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-4 relative group">
                            <button 
                              type="button"
                              onClick={() => {
                                setProgramFormData({
                                  ...programFormData,
                                  subfolders: programFormData.subfolders.filter(sf => sf.id !== subfolder.id)
                                });
                              }}
                              className="absolute top-2 right-2 p-1.5 text-zinc-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="grid grid-cols-[80px_1fr] gap-4">
                              <div 
                                onClick={() => {
                                  setEditingSubfolderId(subfolder.id);
                                  subfolderPhotoInputRef.current?.click();
                                }}
                                className="aspect-square bg-white border-2 border-dashed border-zinc-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50 transition-all overflow-hidden relative"
                              >
                                {subfolder.image ? (
                                  <img src={subfolder.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <Camera className="w-6 h-6 text-zinc-300" />
                                )}
                              </div>
                              <div className="space-y-2">
                                <input 
                                  type="text" 
                                  value={subfolder.name}
                                  onChange={(e) => {
                                    setProgramFormData({
                                      ...programFormData,
                                      subfolders: programFormData.subfolders.map(sf => 
                                        sf.id === subfolder.id ? { ...sf, name: e.target.value } : sf
                                      )
                                    });
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-xs"
                                  placeholder="Название подпапки"
                                />
                                <textarea 
                                  value={subfolder.description}
                                  onChange={(e) => {
                                    setProgramFormData({
                                      ...programFormData,
                                      subfolders: programFormData.subfolders.map(sf => 
                                        sf.id === subfolder.id ? { ...sf, description: e.target.value } : sf
                                      )
                                    });
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-[10px] min-h-[50px]"
                                  placeholder="Описание подпапки"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Разрешенные</label>
                                    <input 
                                      type="text"
                                      value={subfolder.allowedProducts?.join(', ') || ''}
                                      onChange={(e) => {
                                        const val = e.target.value.split(',').map(s => s.trim()).filter(s => s !== '');
                                        setProgramFormData({
                                          ...programFormData,
                                          subfolders: programFormData.subfolders.map(sf => 
                                            sf.id === subfolder.id ? { ...sf, allowedProducts: val } : sf
                                          )
                                        });
                                      }}
                                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-[10px]"
                                      placeholder="Продукты..."
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Запрещенные</label>
                                    <input 
                                      type="text"
                                      value={subfolder.forbiddenProducts?.join(', ') || ''}
                                      onChange={(e) => {
                                        const val = e.target.value.split(',').map(s => s.trim()).filter(s => s !== '');
                                        setProgramFormData({
                                          ...programFormData,
                                          subfolders: programFormData.subfolders.map(sf => 
                                            sf.id === subfolder.id ? { ...sf, forbiddenProducts: val } : sf
                                          )
                                        });
                                      }}
                                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-[10px]"
                                      placeholder="Продукты..."
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Ккал</label>
                                    <input 
                                      type="number"
                                      value={subfolder.targetCalories || ''}
                                      onChange={(e) => {
                                        setProgramFormData({
                                          ...programFormData,
                                          subfolders: programFormData.subfolders.map(sf => 
                                            sf.id === subfolder.id ? { ...sf, targetCalories: Number(e.target.value) } : sf
                                          )
                                        });
                                      }}
                                      className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-[10px]"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Белки</label>
                                    <input 
                                      type="number"
                                      value={subfolder.targetProteins || ''}
                                      onChange={(e) => {
                                        setProgramFormData({
                                          ...programFormData,
                                          subfolders: programFormData.subfolders.map(sf => 
                                            sf.id === subfolder.id ? { ...sf, targetProteins: Number(e.target.value) } : sf
                                          )
                                        });
                                      }}
                                      className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-[10px]"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Жиры</label>
                                    <input 
                                      type="number"
                                      value={subfolder.targetFats || ''}
                                      onChange={(e) => {
                                        setProgramFormData({
                                          ...programFormData,
                                          subfolders: programFormData.subfolders.map(sf => 
                                            sf.id === subfolder.id ? { ...sf, targetFats: Number(e.target.value) } : sf
                                          )
                                        });
                                      }}
                                      className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-[10px]"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Угл</label>
                                    <input 
                                      type="number"
                                      value={subfolder.targetCarbs || ''}
                                      onChange={(e) => {
                                        setProgramFormData({
                                          ...programFormData,
                                          subfolders: programFormData.subfolders.map(sf => 
                                            sf.id === subfolder.id ? { ...sf, targetCarbs: Number(e.target.value) } : sf
                                          )
                                        });
                                      }}
                                      className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-[10px]"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Рецепты ({subfolder.recipeIds.length})</span>
                                <select 
                                  value={subfolderRecipeFilters[subfolder.id] || 'Все'}
                                  onChange={(e) => setSubfolderRecipeFilters({
                                    ...subfolderRecipeFilters,
                                    [subfolder.id]: e.target.value
                                  })}
                                  className="text-[10px] font-bold text-emerald-600 bg-white border border-zinc-100 rounded-md px-1.5 py-0.5 outline-none"
                                >
                                  <option value="Все">Все</option>
                                  {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                              </div>
                              <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                {recipes
                                  .filter(r => (subfolderRecipeFilters[subfolder.id] || 'Все') === 'Все' || r.categories.includes(subfolderRecipeFilters[subfolder.id] ?? ''))
                                  .map(recipe => (
                                  <label key={recipe.id} className="flex items-center gap-2 p-2 bg-white rounded-lg cursor-pointer hover:bg-zinc-50 transition-colors">
                                    <input 
                                      type="checkbox"
                                      checked={subfolder.recipeIds.includes(recipe.id)}
                                      onChange={(e) => {
                                        const newRecipeIds = e.target.checked 
                                          ? [...subfolder.recipeIds, recipe.id]
                                          : subfolder.recipeIds.filter(id => id !== recipe.id);
                                        setProgramFormData({
                                          ...programFormData,
                                          subfolders: programFormData.subfolders.map(sf => 
                                            sf.id === subfolder.id ? { ...sf, recipeIds: newRecipeIds } : sf
                                          )
                                        });
                                      }}
                                      className="w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span className="text-xs font-medium text-zinc-600 truncate">{recipe.title}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-bold text-zinc-700">Выберите рецепты ({programFormData.recipeIds.length})</label>
                        <select 
                          value={programRecipeFilter}
                          onChange={(e) => setProgramRecipeFilter(e.target.value)}
                          className="text-xs font-bold text-emerald-600 bg-emerald-50 border-none rounded-lg px-2 py-1 outline-none"
                        >
                          <option value="Все">Все категории</option>
                          {availableCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {recipes
                          .filter(r => programRecipeFilter === 'Все' || r.categories.includes(programRecipeFilter))
                          .map(recipe => (
                          <label key={recipe.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl cursor-pointer hover:bg-zinc-100 transition-colors">
                            <input 
                              type="checkbox"
                              checked={programFormData.recipeIds.includes(recipe.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setProgramFormData({...programFormData, recipeIds: [...programFormData.recipeIds, recipe.id]});
                                } else {
                                  setProgramFormData({...programFormData, recipeIds: programFormData.recipeIds.filter(id => id !== recipe.id)});
                                }
                              }}
                              className="w-5 h-5 rounded-lg border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm font-bold text-zinc-700 truncate">{recipe.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                  >
                    {editingProgramId ? 'Сохранить изменения' : 'Создать программу'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

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
        return renderPlanner();
      case 'cart':
        return <CartView cart={cart} />;
      case 'tracker':
        return renderTracker();
      case 'programs':
        return renderPrograms();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Program Details Modal */}
      <AnimatePresence>
        {activeCollectionId && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveCollectionId(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setActiveCollectionId(null)}
                    className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-zinc-900">
                      Программа: {programs.find(p => p.id === activeCollectionId)?.name}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
                      {programs.find(p => p.id === activeCollectionId)?.description}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                          <button 
                            onClick={async () => {
                              const program = programs.find(p => p.id === activeCollectionId);
                              if (program) {
                                const newSubfolder: Subfolder = {
                                  id: Math.random().toString(36).substr(2, 9),
                                  name: "Новая подпапка",
                                  description: "",
                                  recipeIds: []
                                };
                                await updateDoc(doc(db, "programs", program.id), {
                                  subfolders: [...(program.subfolders || []), newSubfolder]
                                });
                                setOpenSubfolderId(newSubfolder.id);
                                setEditingSubfolderId(newSubfolder.id);
                              }
                            }}
                            className="text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                          >
                            <FolderPlus className="w-3.5 h-3.5" />
                            Создать подпапку
                          </button>
                          <div className="relative">
                            <button 
                              onClick={() => setProgramAddRecipeDropdown(programAddRecipeDropdown?.subfolderId === 'main' ? null : { programId: activeCollectionId!, subfolderId: 'main' })}
                              className="text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Добавить рецепт
                            </button>

                            <AnimatePresence>
                              {programAddRecipeDropdown?.programId === activeCollectionId && programAddRecipeDropdown?.subfolderId === 'main' && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-40" 
                                    onClick={() => setProgramAddRecipeDropdown(null)}
                                  />
                                  <motion.div 
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden z-50"
                                  >
                                    <AddRecipeOption 
                                      icon={<BookOpen className="w-4 h-4 text-emerald-500" />} 
                                      label="Выбрать из библиотеки" 
                                      onClick={() => { handleStartRecipeSelection(activeCollectionId!, 'main'); setProgramAddRecipeDropdown(null); }}
                                    />
                                    <AddRecipeOption 
                                      icon={<Camera className="w-4 h-4 text-emerald-500" />} 
                                      label="Загрузить фото" 
                                      onClick={() => { setRecipeTarget({ programId: activeCollectionId!, subfolderId: 'main' }); photoInputRef.current?.click(); setProgramAddRecipeDropdown(null); }}
                                    />
                                    <AddRecipeOption 
                                      icon={<FileText className="w-4 h-4 text-emerald-500" />} 
                                      label="PDF документ" 
                                      onClick={() => { setRecipeTarget({ programId: activeCollectionId!, subfolderId: 'main' }); setIsAddingPDF(true); setProgramAddRecipeDropdown(null); }}
                                    />
                                    <AddRecipeOption 
                                      icon={<LinkIcon className="w-4 h-4 text-emerald-500" />} 
                                      label="Вставить ссылку" 
                                      onClick={() => { setRecipeTarget({ programId: activeCollectionId!, subfolderId: 'main' }); setIsAddingLink(true); setProgramAddRecipeDropdown(null); }}
                                    />
                                    <AddRecipeOption 
                                      icon={<Edit3 className="w-4 h-4 text-emerald-500" />} 
                                      label="Добавить вручную" 
                                      onClick={() => { setRecipeTarget({ programId: activeCollectionId!, subfolderId: 'main' }); setIsAddingManual(true); setProgramAddRecipeDropdown(null); }}
                                    />
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                        
                        {/* Compact Resources Display */}
                        {programs.find(p => p.id === activeCollectionId)?.resources && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {programs.find(p => p.id === activeCollectionId)?.resources?.map(res => (
                              <div key={res.id} className="flex items-center gap-2 bg-zinc-50 border border-zinc-100 px-2 py-1 rounded-md group relative">
                                {res.type === 'pdf' ? <FileText className="w-3 h-3 text-red-500" /> : <LinkIcon className="w-3 h-3 text-blue-500" />}
                                <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium text-zinc-600 hover:text-emerald-600 truncate max-w-[120px]">
                                  {res.title}
                                </a>
                                {res.description && (
                                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-20 w-48 p-2 bg-zinc-900 text-white text-[10px] rounded-lg shadow-xl">
                                    {res.description}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Allowed/Forbidden Products Section */}
                        {(() => {
                          const program = programs.find(p => p.id === activeCollectionId);
                          if (!program) return null;
                          const hasRestrictions = (program.allowedProducts?.length ?? 0) > 0 || (program.forbiddenProducts?.length ?? 0) > 0;
                          if (!hasRestrictions) return null;

                          return (
                            <div className="mt-4 border-t border-zinc-100 pt-4">
                              <div className="flex items-center justify-between mb-3">
                                <button 
                                  onClick={() => setShowProducts(!showProducts)}
                                  className="flex items-center gap-2 text-sm font-bold text-zinc-700 hover:text-emerald-600 transition-colors"
                                >
                                  <Activity className="w-4 h-4" />
                                  <span>Ограничения по продуктам</span>
                                  <ChevronDown className={cn("w-4 h-4 transition-transform", showProducts && "rotate-180")} />
                                </button>
                                
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => addProductsToCart([...(program.allowedProducts || []), ...(program.forbiddenProducts || [])])}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-colors"
                                  >
                                    <ShoppingCart className="w-3.5 h-3.5" />
                                    Добавить в корзину
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setEditingEntity({ type: 'program', id: program.id });
                                      setEditFormData({ 
                                        name: program.name, 
                                        description: program.description || '',
                                        targetCalories: program.targetCalories || 0,
                                        targetProteins: program.targetProteins || 0,
                                        targetFats: program.targetFats || 0,
                                        targetCarbs: program.targetCarbs || 0,
                                        resources: program.resources || [],
                                        allowedProducts: program.allowedProducts || [],
                                        forbiddenProducts: program.forbiddenProducts || []
                                      });
                                    }}
                                    className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-zinc-50 rounded-lg transition-colors"
                                    title="Редактировать ограничения"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <AnimatePresence>
                                {showProducts && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="flex flex-col gap-3 mt-1">
                                      {program.allowedProducts && program.allowedProducts.length > 0 && (
                                        <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100">
                                          <p className="text-[10px] font-bold text-emerald-600 uppercase mb-2">Разрешенные</p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {program.allowedProducts.map((p, i) => (
                                              <span key={i} className="text-[10px] bg-white text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100">
                                                {p}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {program.forbiddenProducts && program.forbiddenProducts.length > 0 && (
                                        <div className="bg-red-50/50 rounded-xl p-3 border border-red-100">
                                          <p className="text-[10px] font-bold text-red-600 uppercase mb-2">Запрещенные</p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {program.forbiddenProducts.map((p, i) => (
                                              <span key={i} className="text-[10px] bg-white text-red-700 px-2 py-0.5 rounded-md border border-red-100">
                                                {p}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })()}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => {
                      const program = programs.find(p => p.id === activeCollectionId);
                      if (program) {
                        setEditingEntity({ type: 'program', id: program.id });
                        setEditFormData({ 
                          name: program.name, 
                          description: program.description || '',
                          targetCalories: program.targetCalories || 0,
                          targetProteins: program.targetProteins || 0,
                          targetFats: program.targetFats || 0,
                          targetCarbs: program.targetCarbs || 0,
                          resources: program.resources || [],
                          allowedProducts: program.allowedProducts || [],
                          forbiddenProducts: program.forbiddenProducts || []
                        });
                      }
                    }}
                    className="p-2 rounded-xl transition-colors hover:bg-zinc-100 text-zinc-400"
                    title="Редактировать программу"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => {
                      const program = programs.find(p => p.id === activeCollectionId);
                      if (program) {
                        setProgramToDelete(program);
                      }
                    }}
                    className="p-2 rounded-xl transition-colors hover:bg-red-50 text-zinc-400 hover:text-red-600"
                    title="Удалить программу"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button onClick={() => setActiveCollectionId(null)} className="text-zinc-400 hover:text-zinc-600">
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                {(() => {
                  const program = programs.find(p => p.id === activeCollectionId);
                  if (!program) return null;
                  const collectionRecipes = recipes.filter(r => 
                    program.recipeIds.includes(r.id) && 
                    (programRecipeFilter === 'Все' || r.categories.includes(programRecipeFilter))
                  );
                  
                  return (
                    <div className="space-y-12">
                      {/* Subfolders */}
                      {program.subfolders && program.subfolders.length > 0 && (
                        <div className="space-y-4">
                          {program.subfolders.map(subfolder => {
                            const subfolderRecipes = recipes.filter(r => 
                              subfolder.recipeIds.includes(r.id) &&
                              (programRecipeFilter === 'Все' || r.categories.includes(programRecipeFilter))
                            );
                            if (subfolderRecipes.length === 0 && programRecipeFilter !== 'Все') return null;
                            
                            const isOpen = openSubfolderId === subfolder.id;

                            return (
                              <div 
                                key={subfolder.id} 
                                className={cn(
                                  "bg-emerald-50 rounded-3xl border transition-all overflow-hidden relative",
                                  isOpen ? "border-emerald-200 shadow-sm" : "border-emerald-100"
                                )}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.currentTarget.classList.add('bg-emerald-100');
                                }}
                                onDragLeave={(e) => {
                                  e.currentTarget.classList.remove('bg-emerald-100');
                                }}
                                onDrop={(e: any) => {
                                  e.preventDefault();
                                  e.currentTarget.classList.remove('bg-emerald-100');
                                  const recipeId = e.dataTransfer.getData('recipeId');
                                  const sourceSubfolderId = e.dataTransfer.getData('sourceSubfolderId');
                                  handleDropRecipe(recipeId, subfolder.id, sourceSubfolderId, program.id);
                                }}
                              >
                                    <button 
                                      onClick={() => setOpenSubfolderId(isOpen ? null : subfolder.id)}
                                      className="w-full flex items-center gap-4 p-4 hover:bg-emerald-100/50 transition-colors"
                                    >
                                      {subfolder.image ? (
                                        <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm border border-emerald-200">
                                          <img src={subfolder.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        </div>
                                      ) : (
                                        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 border border-emerald-200">
                                          <FolderPlus className="w-6 h-6" />
                                        </div>
                                      )}
                                      <div className="flex-1 text-left pr-24">
                                        <h3 className="font-bold text-emerald-900">{subfolder.name}</h3>
                                        {subfolder.description && <p className="text-xs text-emerald-600 line-clamp-1">{subfolder.description}</p>}
                                        
                                        <div className="flex flex-wrap gap-2 mt-2">
                                          <div className="relative">
                                            <button 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setProgramAddRecipeDropdown(programAddRecipeDropdown?.subfolderId === subfolder.id ? null : { programId: program.id, subfolderId: subfolder.id });
                                              }}
                                              className="text-[9px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2 py-1 rounded-md flex items-center gap-1 transition-colors shadow-sm"
                                            >
                                              <Plus className="w-3 h-3" />
                                              + Рецепт
                                            </button>

                                            <AnimatePresence>
                                              {programAddRecipeDropdown?.programId === program.id && programAddRecipeDropdown?.subfolderId === subfolder.id && (
                                                <>
                                                  <div 
                                                    className="fixed inset-0 z-40" 
                                                    onClick={(e) => { e.stopPropagation(); setProgramAddRecipeDropdown(null); }}
                                                  />
                                                  <motion.div 
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden z-50"
                                                  >
                                                    <AddRecipeOption 
                                                      icon={<BookOpen className="w-4 h-4 text-emerald-500" />} 
                                                      label="Выбрать из библиотеки" 
                                                      onClick={() => { handleStartRecipeSelection(program.id, subfolder.id); setProgramAddRecipeDropdown(null); }}
                                                    />
                                                    <AddRecipeOption 
                                                      icon={<Camera className="w-4 h-4 text-emerald-500" />} 
                                                      label="Загрузить фото" 
                                                      onClick={() => { setRecipeTarget({ programId: program.id, subfolderId: subfolder.id }); photoInputRef.current?.click(); setProgramAddRecipeDropdown(null); }}
                                                    />
                                                    <AddRecipeOption 
                                                      icon={<FileText className="w-4 h-4 text-emerald-500" />} 
                                                      label="PDF документ" 
                                                      onClick={() => { setRecipeTarget({ programId: program.id, subfolderId: subfolder.id }); setIsAddingPDF(true); setProgramAddRecipeDropdown(null); }}
                                                    />
                                                    <AddRecipeOption 
                                                      icon={<LinkIcon className="w-4 h-4 text-emerald-500" />} 
                                                      label="Вставить ссылку" 
                                                      onClick={() => { setRecipeTarget({ programId: program.id, subfolderId: subfolder.id }); setIsAddingLink(true); setProgramAddRecipeDropdown(null); }}
                                                    />
                                                    <AddRecipeOption 
                                                      icon={<Edit3 className="w-4 h-4 text-emerald-500" />} 
                                                      label="Добавить вручную" 
                                                      onClick={() => { setRecipeTarget({ programId: program.id, subfolderId: subfolder.id }); setIsAddingManual(true); setProgramAddRecipeDropdown(null); }}
                                                    />
                                                  </motion.div>
                                                </>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        </div>

                                            {/* Compact Resources Display for Subfolder */}
                                            {subfolder.resources && subfolder.resources.length > 0 && (
                                              <div className="flex flex-wrap gap-1.5 mt-2">
                                                {subfolder.resources.map(res => (
                                                  <div key={res.id} className="flex items-center gap-1.5 bg-white/40 border border-emerald-100 px-1.5 py-0.5 rounded-md group relative" onClick={e => e.stopPropagation()}>
                                                    {res.type === 'pdf' ? <FileText className="w-2.5 h-2.5 text-red-500" /> : <LinkIcon className="w-2.5 h-2.5 text-blue-500" />}
                                                    <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-[9px] font-medium text-emerald-800 hover:underline truncate max-w-[80px]">
                                                      {res.title}
                                                    </a>
                                                    {res.description && (
                                                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-20 w-40 p-1.5 bg-zinc-800 text-white text-[9px] rounded shadow-lg">
                                                        {res.description}
                                                      </div>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                          <Plus className={cn("w-5 h-5 text-emerald-600 transition-transform", isOpen && "rotate-45")} />
                                    </button>

                                    {/* Allowed/Forbidden Products for Subfolder */}
                                    {isOpen && (subfolder.allowedProducts?.length || subfolder.forbiddenProducts?.length) ? (
                                      <div className="px-4 pb-4">
                                        <div className="flex items-center justify-between mb-2">
                                          <p className="text-[10px] font-bold text-zinc-500 uppercase">Ограничения подпапки</p>
                                          <div className="flex items-center gap-2">
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); addProductsToCart([...(subfolder.allowedProducts || []), ...(subfolder.forbiddenProducts || [])]); }}
                                              className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[8px] font-bold hover:bg-emerald-100 transition-colors"
                                            >
                                              <ShoppingCart className="w-3 h-3" />
                                              В корзину
                                            </button>
                                            <button 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingEntity({ type: 'subfolder', id: subfolder.id, programId: program.id });
                                                setEditFormData({ 
                                                  name: subfolder.name, 
                                                  description: subfolder.description || '',
                                                  targetCalories: subfolder.targetCalories || 0,
                                                  targetProteins: subfolder.targetProteins || 0,
                                                  targetFats: subfolder.targetFats || 0,
                                                  targetCarbs: subfolder.targetCarbs || 0,
                                                  resources: subfolder.resources || [],
                                                  allowedProducts: subfolder.allowedProducts || [],
                                                  forbiddenProducts: subfolder.forbiddenProducts || []
                                                });
                                              }}
                                              className="p-1 text-zinc-400 hover:text-emerald-600 rounded transition-colors"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                          {subfolder.allowedProducts && subfolder.allowedProducts.length > 0 && (
                                            <div className="bg-emerald-50/30 rounded-lg p-2 border border-emerald-100/50">
                                              <p className="text-[8px] font-bold text-emerald-600 uppercase mb-1">Разрешенные</p>
                                              <div className="flex flex-wrap gap-1">
                                                {subfolder.allowedProducts.map((p, i) => (
                                                  <span key={i} className="text-[8px] bg-white text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100">
                                                    {p}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          {subfolder.forbiddenProducts && subfolder.forbiddenProducts.length > 0 && (
                                            <div className="bg-red-50/30 rounded-lg p-2 border border-red-100/50">
                                              <p className="text-[8px] font-bold text-red-600 uppercase mb-1">Запрещенные</p>
                                              <div className="flex flex-wrap gap-1">
                                                {subfolder.forbiddenProducts.map((p, i) => (
                                                  <span key={i} className="text-[8px] bg-white text-red-700 px-1.5 py-0.5 rounded border border-red-100">
                                                    {p}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ) : null}

                                    {/* Subfolder Actions - Positioned AFTER the toggle button and with high z-index */}
                                    <div className="absolute top-4 right-12 z-50 flex items-center gap-2">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingEntity({ type: 'subfolder', id: subfolder.id, programId: program.id });
                                          setEditFormData({ 
                                            name: subfolder.name, 
                                            description: subfolder.description || '',
                                            targetCalories: subfolder.targetCalories || 0,
                                            targetProteins: subfolder.targetProteins || 0,
                                            targetFats: subfolder.targetFats || 0,
                                            targetCarbs: subfolder.targetCarbs || 0,
                                            resources: subfolder.resources || [],
                                            allowedProducts: subfolder.allowedProducts || [],
                                            forbiddenProducts: subfolder.forbiddenProducts || []
                                          });
                                        }}
                                        className="p-2 rounded-lg transition-colors hover:bg-emerald-200 text-emerald-600"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSubfolderToDelete({ programId: program.id, subfolderId: subfolder.id, name: subfolder.name });
                                        }}
                                        className="p-2 rounded-lg transition-colors hover:bg-red-100 text-red-600"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                
                                <AnimatePresence>
                                  {isOpen && (
                                    <motion.div 
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="border-t border-emerald-100"
                                    >
                                      <div className="p-4 space-y-6">
                                        {subfolderRecipes.length > 0 ? (
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {subfolderRecipes.map((recipe) => (
                                              <motion.div 
                                                layout
                                                key={recipe.id} 
                                                onClick={() => setSelectedRecipe(recipe)}
                                                className="bg-white rounded-2xl border border-zinc-200 overflow-hidden hover:shadow-md transition-all group cursor-pointer flex items-center gap-3 p-2 relative"
                                                draggable
                                                onDragStart={(e: any) => {
                                                  e.dataTransfer.setData('recipeId', recipe.id);
                                                  e.dataTransfer.setData('sourceSubfolderId', subfolder.id);
                                                }}
                                              >
                                                {userProfile.allergies.some(allergy => 
                                                  recipe.ingredients.some(ing => ing.toLowerCase().includes(allergy.toLowerCase()))
                                                ) && (
                                                  <div className="absolute -top-1 -right-1 z-10 bg-red-500 text-white p-1 rounded-full shadow-sm" title="Содержит аллергены!">
                                                    <AlertTriangle className="w-2.5 h-2.5" />
                                                  </div>
                                                )}
                                                <div className="w-16 h-16 bg-zinc-100 rounded-xl overflow-hidden flex-shrink-0">
                                                  <img 
                                                    src={recipe.image || `https://picsum.photos/seed/${recipe.id}/200/200`} 
                                                    alt={recipe.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                    referrerPolicy="no-referrer"
                                                  />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <h3 className="font-bold text-sm text-zinc-900 truncate group-hover:text-emerald-600 transition-colors">{recipe.title}</h3>
                                                  <div className="flex items-center gap-1 text-[10px] text-zinc-500 mt-1">
                                                    <Calendar className="w-3 h-3 text-emerald-500" />
                                                    <span>{recipe.time}</span>
                                                  </div>
                                                </div>
                                              </motion.div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="py-8 text-center bg-white/50 rounded-2xl border border-dashed border-emerald-200">
                                            <p className="text-emerald-400 text-xs italic">В этой подпапке пока нет рецептов</p>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Main Recipes */}
                      <div className="space-y-4">
                        <div 
                          className={cn(
                            "bg-zinc-50 rounded-3xl border transition-all overflow-hidden",
                            isMainRecipesOpen ? "border-zinc-200 shadow-sm" : "border-zinc-100"
                          )}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.add('bg-zinc-100');
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.classList.remove('bg-zinc-100');
                          }}
                          onDrop={(e: any) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('bg-zinc-100');
                            const recipeId = e.dataTransfer.getData('recipeId');
                            const sourceSubfolderId = e.dataTransfer.getData('sourceSubfolderId');
                            handleDropRecipe(recipeId, 'main', sourceSubfolderId, program.id);
                          }}
                        >
                          <button 
                            onClick={() => setIsMainRecipesOpen(!isMainRecipesOpen)}
                            className="w-full flex items-center justify-between p-5 hover:bg-zinc-100/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400">
                                <BookOpen className="w-5 h-5" />
                              </div>
                              <h3 className="font-bold text-zinc-900">Загруженные рецепты</h3>
                            </div>
                            <Plus className={cn("w-5 h-5 text-zinc-400 transition-transform", isMainRecipesOpen && "rotate-45")} />
                          </button>

                          <AnimatePresence>
                            {isMainRecipesOpen && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-zinc-100"
                              >
                                <div className="p-6">
                                  {collectionRecipes.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                      {collectionRecipes.map((recipe) => (
                                        <motion.div 
                                          layout
                                          key={recipe.id} 
                                          onClick={() => setSelectedRecipe(recipe)}
                                          className="bg-white rounded-2xl border border-zinc-200 overflow-hidden hover:shadow-xl transition-all group cursor-pointer flex flex-col h-full relative"
                                          draggable
                                          onDragStart={(e: any) => {
                                            e.dataTransfer.setData('recipeId', recipe.id);
                                            e.dataTransfer.setData('sourceSubfolderId', 'main');
                                          }}
                                        >
                                          {userProfile.allergies.some(allergy => 
                                            recipe.ingredients.some(ing => ing.toLowerCase().includes(allergy.toLowerCase()))
                                          ) && (
                                            <div className="absolute top-3 right-3 z-10 bg-red-500 text-white p-1.5 rounded-lg shadow-lg" title="Содержит аллергены!">
                                              <AlertTriangle className="w-4 h-4" />
                                            </div>
                                          )}
                                          <div className="aspect-[4/3] bg-zinc-100 relative overflow-hidden">
                                            <img 
                                              src={recipe.image || `https://picsum.photos/seed/${recipe.id}/600/450`} 
                                              alt={recipe.title}
                                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                              referrerPolicy="no-referrer"
                                            />
                                          </div>
                                          <div className="p-5 flex-1 flex flex-col">
                                            <h3 className="font-bold text-lg mb-2 group-hover:text-emerald-600 transition-colors line-clamp-2 leading-snug">{recipe.title}</h3>
                                            <div className="mt-auto pt-4 border-t border-zinc-100 flex items-center justify-between text-zinc-500 text-sm">
                                              <div className="flex items-center gap-1.5">
                                                <Calendar className="w-4 h-4 text-emerald-500" />
                                                <span className="font-medium">{recipe.time}</span>
                                              </div>
                                            </div>
                                          </div>
                                        </motion.div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="py-12 text-center bg-zinc-50/50 rounded-3xl border border-dashed border-zinc-200">
                                      <p className="text-zinc-400 text-sm italic">В этой папке пока нет рецептов</p>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {collectionRecipes.length === 0 && (!program.subfolders || program.subfolders.length === 0 || (programRecipeFilter !== 'Все' && !program.subfolders.some(sf => recipes.filter(r => sf.recipeIds.includes(r.id) && r.categories.includes(programRecipeFilter)).length > 0))) && (
                        <div className="py-12 text-center">
                          <p className="text-zinc-500">
                            {programRecipeFilter === 'Все' 
                              ? "В этом сборнике пока нет рецептов." 
                              : `Нет рецептов в категории "${programRecipeFilter}"`}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      {/* Product Add Modal (Planner) */}
      <AnimatePresence>
        {isAddingProduct && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingProduct(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Добавить продукт в план</h3>
                <button onClick={() => setIsAddingProduct(false)} className="text-zinc-400 hover:text-zinc-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddProductToPlanner} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1">Название продукта *</label>
                    <input 
                      required
                      type="text" 
                      value={productFormData.name}
                      onChange={(e) => setProductFormData({...productFormData, name: e.target.value})}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Например: Яблоко"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1">Количество</label>
                    <input 
                      type="text" 
                      value={productFormData.amount}
                      onChange={(e) => setProductFormData({...productFormData, amount: e.target.value})}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Например: 1 шт или 200г"
                    />
                  </div>
                  
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Ккал</label>
                      <input 
                        type="number" 
                        value={productFormData.calories}
                        onChange={(e) => setProductFormData({...productFormData, calories: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 bg-white border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Белки (г)</label>
                      <input 
                        type="number" 
                        value={productFormData.proteins}
                        onChange={(e) => setProductFormData({...productFormData, proteins: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 bg-white border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Жиры (г)</label>
                      <input 
                        type="number" 
                        value={productFormData.fats}
                        onChange={(e) => setProductFormData({...productFormData, fats: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 bg-white border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Углеводы (г)</label>
                      <input 
                        type="number" 
                        value={productFormData.carbs}
                        onChange={(e) => setProductFormData({...productFormData, carbs: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 bg-white border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" 
                      />
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Добавить в план
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


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
                      setActiveCollectionId(selectionTarget.programId);
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

      {/* Recipe Picker Modal */}
      <AnimatePresence>
        {isRecipePickerOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRecipePickerOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">Выбрать рецепт</h3>
                <button onClick={() => setIsRecipePickerOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {recipes.map(recipe => (
                    <button 
                      key={recipe.id}
                      onClick={() => handleAddToPlanner(pickingMealInfo!.date, pickingMealInfo!.mealType, recipe.id)}
                      className="flex items-center gap-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                        <img 
                          src={recipe.image || `https://picsum.photos/seed/${recipe.id}/200/200`} 
                          alt={recipe.title}
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900 group-hover:text-emerald-700 transition-colors line-clamp-1">{recipe.title}</p>
                        <p className="text-xs text-zinc-400">{recipe.macros.calories} ккал</p>
                      </div>
                    </button>
                  ))}
                </div>
                {recipes.length === 0 && (
                  <div className="text-center py-10 text-zinc-400">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>У вас пока нет рецептов</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Entity Editing Modal */}
      <AnimatePresence>
        {editingEntity && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingEntity(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <h3 className="text-lg font-bold">
                  {editingEntity.type === 'program' ? 'Редактировать программу' : 'Редактировать подпапку'}
                </h3>
                <button onClick={() => setEditingEntity(null)} className="text-zinc-400 hover:text-zinc-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Название</label>
                    <input 
                      type="text"
                      value={editFormData.name}
                      onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Название"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Описание</label>
                    <textarea 
                      value={editFormData.description}
                      onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
                      placeholder="Описание"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 pt-4 border-t border-zinc-100">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Разрешенные продукты (через запятую)</label>
                      <input 
                        type="text"
                        value={editFormData.allowedProducts.join(', ')}
                        onChange={e => setEditFormData({ ...editFormData, allowedProducts: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Курица, овощи..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Запрещенные продукты (через запятую)</label>
                      <input 
                        type="text"
                        value={editFormData.forbiddenProducts.join(', ')}
                        onChange={e => setEditFormData({ ...editFormData, forbiddenProducts: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Сахар, мучное..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Калории (ккал)</label>
                      <input 
                        type="number"
                        value={editFormData.targetCalories}
                        onChange={e => setEditFormData({ ...editFormData, targetCalories: parseInt(e.target.value) || 0 })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Белки (г)</label>
                      <input 
                        type="number"
                        value={editFormData.targetProteins}
                        onChange={e => setEditFormData({ ...editFormData, targetProteins: parseInt(e.target.value) || 0 })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Жиры (г)</label>
                      <input 
                        type="number"
                        value={editFormData.targetFats}
                        onChange={e => setEditFormData({ ...editFormData, targetFats: parseInt(e.target.value) || 0 })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Углеводы (г)</label>
                      <input 
                        type="number"
                        value={editFormData.targetCarbs}
                        onChange={e => setEditFormData({ ...editFormData, targetCarbs: parseInt(e.target.value) || 0 })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-100 space-y-4">
                    <h4 className="text-sm font-bold text-zinc-900">Ресурсы</h4>
                    
                    <div className="space-y-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="Название ресурса"
                          className="flex-1 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                          id="new-resource-title"
                        />
                        <button 
                          onClick={() => {
                            const titleInput = document.getElementById('new-resource-title') as HTMLInputElement;
                            const urlInput = document.getElementById('new-resource-url') as HTMLInputElement;
                            if (!urlInput.value) return alert("Введите URL");
                            const newRes: Resource = {
                              id: Math.random().toString(36).substr(2, 9),
                              type: 'link',
                              url: urlInput.value,
                              title: titleInput.value || 'Ссылка',
                            };
                            setEditFormData(prev => ({ ...prev, resources: [...prev.resources, newRes] }));
                            titleInput.value = '';
                            urlInput.value = '';
                          }}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                        >
                          + Ссылка
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="https://..."
                          className="flex-1 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                          id="new-resource-url"
                        />
                        <button 
                          onClick={() => subfolderPdfInputRef.current?.click()}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors flex items-center gap-1"
                        >
                          <Upload className="w-3 h-3" />
                          Документ
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {editFormData.resources.length === 0 ? (
                        <p className="text-[10px] text-zinc-400 italic">Нет добавленных ресурсов</p>
                      ) : (
                        editFormData.resources.map(res => (
                          <div key={res.id} className="flex items-center justify-between bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                            <div className="flex items-center gap-2 overflow-hidden">
                              {res.type === 'pdf' ? <FileText className="w-3 h-3 text-red-500" /> : <LinkIcon className="w-3 h-3 text-blue-500" />}
                              <span className="text-[10px] font-medium text-zinc-600 truncate">{res.title}</span>
                            </div>
                            <button 
                              onClick={() => {
                                setEditFormData(prev => ({
                                  ...prev,
                                  resources: prev.resources.filter(r => r.id !== res.id)
                                }));
                              }}
                              className="text-zinc-400 hover:text-red-500"
                            >
                              <Plus className="w-3 h-3 rotate-45" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex gap-3">
                {editingEntity.type === 'subfolder' && (
                  <button 
                    onClick={() => {
                      setSubfolderToDelete({ programId: editingEntity.programId!, subfolderId: editingEntity.id, name: editFormData.name });
                      setEditingEntity(null);
                    }}
                    className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    title="Удалить подпапку"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button 
                  onClick={() => setEditingEntity(null)}
                  className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button 
                  onClick={async () => {
                    if (editingEntity.type === 'program') {
                      await updateDoc(doc(db, "programs", editingEntity.id), {
                        name: editFormData.name,
                        description: editFormData.description,
                        targetCalories: editFormData.targetCalories,
                        targetProteins: editFormData.targetProteins,
                        targetFats: editFormData.targetFats,
                        targetCarbs: editFormData.targetCarbs,
                        resources: editFormData.resources,
                        allowedProducts: editFormData.allowedProducts,
                        forbiddenProducts: editFormData.forbiddenProducts
                      });
                    } else {
                      const program = programs.find(p => p.id === editingEntity.programId);
                      const newSubfolders = program?.subfolders?.map(sf => 
                        sf.id === editingEntity.id ? { 
                          ...sf, 
                          name: editFormData.name, 
                          description: editFormData.description,
                          targetCalories: editFormData.targetCalories,
                          targetProteins: editFormData.targetProteins,
                          targetFats: editFormData.targetFats,
                          targetCarbs: editFormData.targetCarbs,
                          resources: editFormData.resources,
                          allowedProducts: editFormData.allowedProducts,
                          forbiddenProducts: editFormData.forbiddenProducts
                        } : sf
                      );
                      await updateDoc(doc(db, "programs", editingEntity.programId!), { subfolders: newSubfolders });
                    }
                    setEditingEntity(null);
                  }}
                  className="flex-1 py-3 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-lg"
                >
                  Сохранить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Resource Adding Modal */}
      <AnimatePresence>
        {activeResourceForm && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveResourceForm(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-6"
            >
              <h3 className="text-lg font-bold mb-4">
                {activeResourceForm.type === 'link' ? 'Добавить ссылку' : 'Добавить документ'}
              </h3>
              <div className="space-y-4">
                {activeResourceForm.type === 'pdf' && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col items-center gap-2 text-center">
                    <button 
                      onClick={() => subfolderPdfInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <Upload className="w-4 h-4" />
                      Загрузить файл
                    </button>
                    <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider">Или введите URL ниже</p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">URL</label>
                  <input 
                    type="text"
                    value={resourceFormData.url}
                    onChange={e => setResourceFormData({ ...resourceFormData, url: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Название</label>
                  <input 
                    type="text"
                    value={resourceFormData.title}
                    onChange={e => setResourceFormData({ ...resourceFormData, title: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Название"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Описание (необязательно)</label>
                  <textarea 
                    value={resourceFormData.description}
                    onChange={e => setResourceFormData({ ...resourceFormData, description: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[80px]"
                    placeholder="Описание"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setActiveResourceForm(null)}
                    className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
                  >
                    Отмена
                  </button>
                  <button 
                    onClick={async () => {
                      if (!resourceFormData.url) return alert("Введите URL");
                      const newResource: Resource = {
                        id: Math.random().toString(36).substr(2, 9),
                        type: activeResourceForm.type,
                        url: resourceFormData.url,
                        title: resourceFormData.title || (activeResourceForm.type === 'link' ? 'Ссылка' : 'Документ'),
                        description: resourceFormData.description
                      };
                      
                      const program = programs.find(p => p.id === activeCollectionId);
                      if (program) {
                        if (activeResourceForm.targetId === 'main') {
                          await updateDoc(doc(db, "programs", program.id), {
                            resources: [...(program.resources || []), newResource]
                          });
                        } else {
                          const newSubfolders = program.subfolders?.map(sf => 
                            sf.id === activeResourceForm.targetId ? { ...sf, resources: [...(sf.resources || []), newResource] } : sf
                          );
                          await updateDoc(doc(db, "programs", program.id), { subfolders: newSubfolders });
                        }
                      }
                      setActiveResourceForm(null);
                      setResourceFormData({ url: '', title: '', description: '' });
                    }}
                    className="flex-1 py-3 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-lg"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <input 
        type="file" 
        ref={subfolderPdfInputRef} 
        className="hidden" 
        accept="application/pdf" 
        onChange={handleSubfolderPdfUpload} 
      />

      {/* Program Delete Confirmation Modal */}
      <AnimatePresence>
        {programToDelete && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setProgramToDelete(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-6 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold mb-2">Удалить программу?</h3>
              <p className="text-zinc-500 text-sm mb-6">
                Действительно хочешь удалить программу <span className="font-bold text-zinc-900">"{programToDelete.name}"</span>?
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setProgramToDelete(null)}
                  className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button 
                  onClick={async () => {
                    try {
                      await deleteDoc(doc(db, "programs", programToDelete.id));
                      setProgramToDelete(null);
                      setActiveCollectionId(null);
                    } catch (err) {
                      console.error("Error deleting program:", err);
                    }
                  }}
                  className="flex-1 py-3 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-lg"
                >
                  Удалить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Subfolder Delete Confirmation Modal */}
      <AnimatePresence>
        {subfolderToDelete && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSubfolderToDelete(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-6 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold mb-2">Удалить подпапку?</h3>
              <p className="text-zinc-500 text-sm mb-6">
                Действительно хочешь удалить подпапку <span className="font-bold text-zinc-900">"{subfolderToDelete.name}"</span>?
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setSubfolderToDelete(null)}
                  className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button 
                  onClick={async () => {
                    const program = programs.find(p => p.id === subfolderToDelete.programId);
                    if (program) {
                      await updateDoc(doc(db, "programs", program.id), {
                        subfolders: program.subfolders?.filter(sf => sf.id !== subfolderToDelete.subfolderId)
                      });
                    }
                    setSubfolderToDelete(null);
                    setEditingSubfolderId(null);
                  }}
                  className="flex-1 py-3 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-lg"
                >
                  Удалить
                </button>
              </div>
            </motion.div>
          </div>
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
