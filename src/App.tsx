/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Settings,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, getDoc } from "firebase/firestore";
import { db } from "./infrastructure/firebaseApp";
import { isStaple } from "@/features/cart/services/staples";

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
import { TrackerView } from '@/features/tracker/TrackerView';

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<'ru' | 'de' | 'en'>('ru');
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
  const { activeNutritionPlan } = useNutritionPlan();
  const { programs } = useData();

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
        return (
          <TrackerView
            checkedEntries={checkedEntries}
            onCheckedEntriesChange={setCheckedEntries}
            mealTypes={mealTypes}
            onSelectRecipe={setSelectedRecipe}
            onNavigateToPlanner={() => setActiveTab('planner')}
          />
        );
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
