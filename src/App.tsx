/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
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

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const cropImage = (base64: string, box: { ymin: number, xmin: number, ymax: number, xmax: number }): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }

      // Gemini bounding boxes are normalized 0-1000
      const x = (box.xmin / 1000) * img.width;
      const y = (box.ymin / 1000) * img.height;
      const width = ((box.xmax - box.xmin) / 1000) * img.width;
      const height = ((box.ymax - box.ymin) / 1000) * img.height;

      if (width <= 0 || height <= 0) {
        resolve(base64);
        return;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
};

const extractImageFromPDF = async (pdfData: string, pageNumber: number, box: { ymin: number, xmin: number, ymax: number, xmax: number }): Promise<string> => {
  try {
    const binaryString = atob(pdfData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const loadingTask = pdfjs.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return '';

    canvas.height = viewport.height;
    canvas.width = viewport.width;

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
  } catch (error) {
    console.error("Error extracting image from PDF:", error);
    return '';
  }
};

const AddRecipeOption = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="w-full px-4 py-3 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-3 transition-colors"
  >
    {icon}
    {label}
  </button>
);

type Tab = 'recipes' | 'planner' | 'cart' | 'tracker' | 'programs';

interface Recipe {
  id: string;
  title: string;
  image?: string;
  sourceUrl?: string;
  author?: string;
  time: string;
  servings: number;
  categories: string[];
  ingredients: string[];
  steps: string[];
  macros: {
    calories: number;
    proteins: number;
    fats: number;
    carbs: number;
  };
  substitutions?: string;
  isFavorite?: boolean;
  createdAt: string;
}

type UserProfile = {
  name: string;
  age: number;
  gender: 'male' | 'female';
  currentWeight: number;
  targetWeight: number;
  targetCalories: number;
  targetProteins: number;
  targetFats: number;
  targetCarbs: number;
  waterGoal: number;
  allergies: string[];
};

type RecipeView = 'all' | 'favorites';

type Resource = {
  id: string;
  type: 'pdf' | 'link';
  url: string;
  title: string;
  description?: string;
};

type Subfolder = {
  id: string;
  name: string;
  description: string;
  image?: string;
  recipeIds: string[];
  pdfUrl?: string; // Keep for backward compatibility
  link?: string;   // Keep for backward compatibility
  resources?: Resource[];
  targetCalories?: number;
  targetProteins?: number;
  targetFats?: number;
  targetCarbs?: number;
  allowedProducts?: string[];
  forbiddenProducts?: string[];
};

type Program = {
  id: string;
  name: string;
  description: string;
  creator: string;
  link: string;     // Keep for backward compatibility
  recipeIds: string[];
  createdAt: string;
  image?: string;
  pdfUrl?: string;  // Keep for backward compatibility
  subfolders?: Subfolder[];
  resources?: Resource[];
  targetCalories?: number;
  targetProteins?: number;
  targetFats?: number;
  targetCarbs?: number;
  allowedProducts?: string[];
  forbiddenProducts?: string[];
};

type PlannerEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: string;
  type: 'recipe' | 'product';
  recipeId?: string;
  productName?: string;
  amount?: string;
  macros?: {
    calories: number;
    proteins: number;
    fats: number;
    carbs: number;
  };
};

type PlannerViewScale = 'day' | 'week' | 'month';
type PlannerViewMode = 'calendar' | 'list';

interface CartItem {
  id: string;
  name: string;
  amount: string;
  sourceDishes: string[];
  checked: boolean;
  isBasic?: boolean;
  createdAt: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('recipes');
  const [recipeView, setRecipeView] = useState<RecipeView>('all');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [isAddingPDF, setIsAddingPDF] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isUpdatingImage, setIsUpdatingImage] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [recipeLink, setRecipeLink] = useState('');
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const programPhotoInputRef = React.useRef<HTMLInputElement>(null);
  const programPdfInputRef = React.useRef<HTMLInputElement>(null);
  const subfolderPhotoInputRef = React.useRef<HTMLInputElement>(null);
  const subfolderPdfInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Resource adding state
  const [activeResourceForm, setActiveResourceForm] = useState<{
    targetId: string; // subfolder.id or 'main'
    type: 'link' | 'pdf';
  } | null>(null);
  const [resourceFormData, setResourceFormData] = useState({ url: '', title: '', description: '' });
  
  // Filter states
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterAuthors, setFilterAuthors] = useState<string[]>([]);
  const [filterPrograms, setFilterPrograms] = useState<string[]>([]);
  const [filterMaxTime, setFilterMaxTime] = useState<number>(120);
  const [filterMaxCalories, setFilterMaxCalories] = useState<number>(1000);
  
  // Planner state
  const [isPlanning, setIsPlanning] = useState(false);
  const [planDetails, setPlanDetails] = useState({ day: format(new Date(), 'yyyy-MM-dd'), meal: 'Завтрак' });
  
  // Categories state
  const [availableCategories, setAvailableCategories] = useState([
    'Завтрак', 'Обед', 'Ужин', 'Перекус', 'Десерт', 'Мясо', 'Рыба', 'Веган', 'Вегетарианское', 'Напитки', 'Основное блюдо', 'Гарниры', 'Салаты', 'Супы'
  ]);
  
  // Filter state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
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
  const [isAddRecipeDropdownOpen, setIsAddRecipeDropdownOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
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
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const allowedText = currentTargets.allowedProducts && currentTargets.allowedProducts.length > 0 
        ? `Разрешенные продукты: ${currentTargets.allowedProducts.join(', ')}.` 
        : '';
      const forbiddenText = currentTargets.forbiddenProducts && currentTargets.forbiddenProducts.length > 0 
        ? `Запрещенные продукты: ${currentTargets.forbiddenProducts.join(', ')}.` 
        : '';

      const prompt = `У меня осталось ${remaining.calories} ккал, ${remaining.proteins}г белков, ${remaining.fats}г жиров, ${remaining.carbs}г углеводов на сегодня. 
        Посоветуй 3 варианта перекуса.
        ТЕКУЩИЙ ПЛАН ПИТАНИЯ: ${currentTargets.name}.
        ${allowedText}
        ${forbiddenText}
        ВАЖНО: Ты ДОЛЖЕН строго следовать текущему плану питания. 
        Если указаны разрешенные продукты, предлагай ТОЛЬКО их или комбинации из них.
        Если указаны запрещенные продукты, НИКОГДА их не предлагай.
        Если выбираешь рецепт из списка, укажи его ID и адаптируй порцию так, чтобы она вписалась в остаток.
        Если это комбинация продуктов, опиши их (например: "1 жменя миндаля и 1 морковка 30г").
        Учитывай мои аллергии и непереносимости: ${userProfile.allergies.length > 0 ? userProfile.allergies.join(', ') : 'нет'}.
        Мои рецепты: ${recipes.map(r => `${r.title} (ID: ${r.id}, КБЖУ на порцию: ${r.macros.calories}/${r.macros.proteins}/${r.macros.fats}/${r.macros.carbs})`).join(', ')}
        
        Верни ответ в формате JSON:
        {
          "options": [
            { 
              "id": "unique_string_id",
              "type": "recipe" | "product",
              "recipeId": "id если это рецепт",
              "description": "название блюда или описание продуктов (включая количество/вес)", 
              "macros": { "calories": number, "proteins": number, "fats": number, "carbs": number } 
            }
          ],
          "reason": "краткое пояснение, почему эти варианты подходят"
        }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text ?? '{}');
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
  const [filterSortBy, setFilterSortBy] = useState<'newest' | 'oldest' | 'time' | 'calories'>('newest');
  const [mealTypes, setMealTypes] = useState(['Завтрак', 'Обед', 'Ужин', 'Перекус']);
  const [activeAddDropdown, setActiveAddDropdown] = useState<string | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isAddingProductToRecipe, setIsAddingProductToRecipe] = useState(false);
  const [newCartItemName, setNewCartItemName] = useState('');
  const [newCartItemAmount, setNewCartItemAmount] = useState('');
  const [isCreatingProgram, setIsCreatingProgram] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isCategoryDeleteConfirmOpen, setIsCategoryDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [isProgramSelectionOpen, setIsProgramSelectionOpen] = useState(false);
  const [activeNutritionPlan, setActiveNutritionPlan] = useState<{
    name: string;
    subfolderName?: string;
    calories: number;
    proteins: number;
    fats: number;
    carbs: number;
    isCustom: boolean;
    programId?: string;
    subfolderId?: string;
    allowedProducts?: string[];
    forbiddenProducts?: string[];
  } | null>(null);
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
    const BASIC_KEYWORDS = ['соль', 'сахар', 'перец', 'лук', 'чеснок', 'масло', 'мука', 'сода', 'уксус', 'вода', 'специи', 'приправа'];
    
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

        const isBasic = BASIC_KEYWORDS.some(k => name.toLowerCase().includes(k));

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
    const savedPlan = localStorage.getItem('activeNutritionPlan');
    if (savedPlan) {
      try {
        setActiveNutritionPlan(JSON.parse(savedPlan));
      } catch (e) {
        console.error("Error parsing saved plan:", e);
      }
    }

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

  const handleSaveSettings = async () => {
    try {
      await setDoc(doc(db, "settings", "profile"), userProfile);
      setIsSettingsOpen(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Не удалось сохранить настройки");
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    sourceUrl: '',
    image: '' as string | null,
    time: '',
    servings: 2,
    categories: [] as string[],
    ingredients: '',
    steps: '',
    calories: 0,
    proteins: 0,
    fats: 0,
    carbs: 0,
    substitutions: ''
  });

  const toggleFavorite = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;

    try {
      await updateDoc(doc(db, "recipes", id), {
        isFavorite: !recipe.isFavorite
      });
      
      if (selectedRecipe?.id === id) {
        setSelectedRecipe({ ...selectedRecipe, isFavorite: !selectedRecipe.isFavorite });
      }
    } catch (error) {
      console.error("Error updating favorite status:", error);
    }
  };

  const generateRecipeImage = async (title: string, ingredients: string[]) => {
    try {
      const { imageDataUri } = await aiClient.generateImage({ title, ingredients });
      return imageDataUri;
    } catch (error) {
      console.error("Error generating recipe image:", error);
      return null;
    }
  };

  const addRecipeToTarget = async (recipeId: string) => {
    if (!recipeTarget) return;
    const { programId, subfolderId } = recipeTarget;
    const program = programs.find(p => p.id === programId);
    if (!program) return;

    if (subfolderId === 'main') {
      await updateDoc(doc(db, "programs", programId), {
        recipeIds: [...program.recipeIds, recipeId]
      });
    } else {
      const newSubfolders = (program.subfolders ?? []).map(sf =>
        sf.id === subfolderId ? { ...sf, recipeIds: [...sf.recipeIds, recipeId] } : sf
      );
      await updateDoc(doc(db, "programs", programId), {
        subfolders: newSubfolders
      });
    }
    setRecipeTarget(null);
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    
    let imageUrl = formData.image;
    if (!imageUrl) {
      const generated = await generateRecipeImage(formData.title, formData.ingredients.split('\n'));
      if (generated) imageUrl = generated;
    }
    
    const recipeData = {
      title: formData.title,
      author: formData.author,
      sourceUrl: formData.sourceUrl,
      image: imageUrl,
      time: formData.time || '30 мин',
      servings: formData.servings,
      categories: formData.categories,
      ingredients: formData.ingredients.split('\n').map(s => s.trim()).filter(Boolean),
      steps: formData.steps.split('\n').map(s => s.trim()).filter(Boolean),
      macros: {
        calories: formData.calories,
        proteins: formData.proteins,
        fats: formData.fats,
        carbs: formData.carbs,
      },
      substitutions: formData.substitutions,
      isFavorite: editingId ? recipes.find(r => r.id === editingId)?.isFavorite : false,
      createdAt: editingId ? (recipes.find(r => r.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };
    
    try {
      if (editingId) {
        await updateDoc(doc(db, "recipes", editingId), recipeData);
        if (selectedRecipe?.id === editingId) {
          setSelectedRecipe({ id: editingId, ...recipeData } as Recipe);
        }
      } else {
        const docRef = await addDoc(collection(db, "recipes"), recipeData);
        if (recipeTarget) {
          await addRecipeToTarget(docRef.id);
        }
      }

      setIsAddingManual(false);
      setEditingId(null);
      setFormData({
        title: '', author: '', sourceUrl: '', image: null, time: '', servings: 2,
        categories: [], ingredients: '', steps: '',
        calories: 0, proteins: 0, fats: 0, carbs: 0, substitutions: ''
      });
    } catch (error) {
      console.error("Error saving recipe:", error);
      alert("Ошибка при сохранении рецепта");
    }
  };

  const handleEdit = (recipe: Recipe) => {
    setEditingId(recipe.id);
    setFormData({
      title: recipe.title,
      author: recipe.author || '',
      sourceUrl: recipe.sourceUrl || '',
      image: recipe.image || null,
      time: recipe.time,
      servings: recipe.servings,
      categories: recipe.categories,
      ingredients: recipe.ingredients.join('\n'),
      steps: recipe.steps.join('\n'),
      calories: recipe.macros.calories,
      proteins: recipe.macros.proteins,
      fats: recipe.macros.fats,
      carbs: recipe.macros.carbs,
      substitutions: recipe.substitutions || ''
    });
    setIsAddingManual(true);
    setSelectedRecipe(null);
  };

  const analyzePhoto = async (images: { base64: string, mimeType: string }[], autoSave: boolean = false) => {
    setIsScanning(true);
    try {
      const imageParts = images.map(img => ({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64.split(',')[1]
        }
      }));
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...imageParts,
          {
            text: `Extract recipe details from these images. Return structured data in Russian. 
            Include title, ingredients (as a single string with newlines), steps (as a single string with newlines), time, calories, proteins, fats, carbs, servings.
            ВАЖНО: Если КБЖУ (калории, белки, жиры, углеводы) не указаны в источнике явно, ПОЖАЛУЙСТА, РАССЧИТАЙТЕ ИХ самостоятельно на основе ингредиентов и их количества.
            For categories, ONLY choose from this list: ${availableCategories.join(', ')}.
            If you find any URL or link to the original source in the text, include it in the 'sourceUrl' field.
            Also, provide the bounding box [ymin, xmin, ymax, xmax] for the main dish shown in the images as 'dishBoundingBox'. Use normalized coordinates (0-1000).`
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              ingredients: { type: Type.STRING },
              steps: { type: Type.STRING },
              time: { type: Type.STRING },
              calories: { type: Type.NUMBER },
              proteins: { type: Type.NUMBER },
              fats: { type: Type.NUMBER },
              carbs: { type: Type.NUMBER },
              categories: { type: Type.ARRAY, items: { type: Type.STRING } },
              servings: { type: Type.NUMBER },
              sourceUrl: { type: Type.STRING, description: "URL to the original recipe source if found" },
              dishBoundingBox: {
                type: Type.OBJECT,
                properties: {
                  ymin: { type: Type.NUMBER },
                  xmin: { type: Type.NUMBER },
                  ymax: { type: Type.NUMBER },
                  xmax: { type: Type.NUMBER }
                }
              }
            },
            required: ["title", "ingredients", "steps", "time", "calories", "proteins", "fats", "carbs", "categories", "servings"]
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      
      const firstImageBase64 = images[0]?.base64 ?? '';
      let dishImage = firstImageBase64;
      if (data.dishBoundingBox) {
        dishImage = await cropImage(firstImageBase64, data.dishBoundingBox);
      }
      
      if (!dishImage) {
        const generated = await generateRecipeImage(data.title || 'Новый рецепт', (data.ingredients || '').split('\n'));
        if (generated) dishImage = generated;
      }

      const newRecipeData = {
        image: dishImage,
        title: data.title || 'Новый рецепт',
        ingredients: data.ingredients || '',
        steps: data.steps || '',
        time: data.time || '30 мин',
        calories: data.calories || 0,
        proteins: data.proteins || 0,
        fats: data.fats || 0,
        carbs: data.carbs || 0,
        categories: (data.categories || []).filter((c: string) => availableCategories.includes(c.toLowerCase())),
        servings: data.servings || 2,
        sourceUrl: data.sourceUrl || ''
      };

      if (autoSave) {
        const recipeToSave = {
          title: newRecipeData.title,
          author: '',
          sourceUrl: newRecipeData.sourceUrl,
          image: newRecipeData.image,
          time: newRecipeData.time,
          servings: newRecipeData.servings,
          categories: newRecipeData.categories,
          ingredients: newRecipeData.ingredients.split('\n').map((s: string) => s.trim()).filter(Boolean),
          steps: newRecipeData.steps.split('\n').map((s: string) => s.trim()).filter(Boolean),
          macros: {
            calories: newRecipeData.calories,
            proteins: newRecipeData.proteins,
            fats: newRecipeData.fats,
            carbs: newRecipeData.carbs,
          },
          substitutions: '',
          isFavorite: false,
          createdAt: new Date().toISOString()
        };
        const docRef = await addDoc(collection(db, "recipes"), recipeToSave);
        if (recipeTarget) {
          await addRecipeToTarget(docRef.id);
        }
        setIsAddingManual(false);
        alert("Рецепт успешно распознан и сохранен!");
      } else {
        setFormData(prev => ({
          ...prev,
          ...newRecipeData
        }));
      }
    } catch (error) {
      console.error("Error analyzing photo:", error);
      alert("Не удалось автоматически распознать текст на фото. Пожалуйста, заполните данные вручную.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeLink.trim()) return;

    setIsScanning(true);
    try {
      const result = await aiClient.importFromUrl({
        url: recipeLink,
        availableCategories,
      });
      const r = result.recipe;

      const recipeData = {
        title: r.title,
        author: r.author ?? "",
        image: r.dishImage ?? null,
        sourceUrl: r.sourceUrl ?? recipeLink,
        time: r.time,
        servings: r.servings,
        categories: r.categories,
        ingredients: r.ingredients,
        steps: r.steps,
        macros: r.macros,
        isFavorite: false,
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, "recipes"), recipeData);
      if (recipeTarget) {
        await addRecipeToTarget(docRef.id);
      }

      setIsAddingLink(false);
      setRecipeLink('');
      alert("Рецепт успешно добавлен!");
    } catch (error) {
      console.error("Error scanning link:", error);
      alert("Не удалось распознать рецепт по ссылке. Попробуйте другую ссылку или добавьте вручную.");
    } finally {
      setIsScanning(false);
    }
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
        recipeId
      });
      setIsPlanning(false);
      setIsRecipePickerOpen(false);
      alert("Добавлено в календарь");
    } catch (error) {
      console.error("Error adding to planner:", error);
      alert("Ошибка при добавлении в календарь");
    }
  };

  const handleAddProductToRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productFormData.name) return;
    
    const ingredientStr = `${productFormData.name}${productFormData.amount ? ` (${productFormData.amount})` : ''}`;
    const currentIngredients = formData.ingredients ? formData.ingredients + '\n' + ingredientStr : ingredientStr;
    
    setFormData({
      ...formData,
      ingredients: currentIngredients,
      calories: formData.calories + (productFormData.calories || 0),
      proteins: formData.proteins + (productFormData.proteins || 0),
      fats: formData.fats + (productFormData.fats || 0),
      carbs: formData.carbs + (productFormData.carbs || 0)
    });
    
    setIsAddingProductToRecipe(false);
    setProductFormData({ name: '', amount: '', calories: 0, proteins: 0, fats: 0, carbs: 0 });
  };

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
    if (file) {
      // In a real app we'd upload to storage, here we'll use a data URL or just a mock
      // For simplicity in this environment, we'll store the name or a dummy URL
      setProgramFormData({ ...programFormData, pdfUrl: file.name });
      alert(`Файл ${file.name} выбран`);
    }
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
                
                const BASIC_KEYWORDS = ['соль', 'сахар', 'перец', 'лук', 'чеснок', 'масло', 'мука', 'сода', 'уксус', 'вода', 'специи', 'приправа'];

                entries.forEach(e => {
                  const recipe = getRecipeById(e.recipeId);
                  if (recipe) {
                    recipe.ingredients.forEach(ing => {
                      const lowerIng = ing.toLowerCase();
                      const isBasic = BASIC_KEYWORDS.some(k => lowerIng.includes(k));
                      
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

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="mb-8">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">
            Твой банк рецептов пока пуст
          </h2>
          <p className="text-zinc-500">
            Добавь первый рецепт удобным способом:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ActionButton 
            icon={<Camera className="w-5 h-5" />} 
            label="Фото рецепта" 
            onClick={() => photoInputRef.current?.click()}
          />
          <ActionButton 
            icon={<FileText className="w-5 h-5" />} 
            label="PDF документ" 
            onClick={() => setIsAddingPDF(true)}
          />
          <ActionButton 
            icon={<LinkIcon className="w-5 h-5" />} 
            label="Вставить ссылку" 
            onClick={() => setIsAddingLink(true)}
          />
          <ActionButton 
            icon={<Edit3 className="w-5 h-5" />} 
            label="Добавить вручную" 
            onClick={() => setIsAddingManual(true)}
          />
        </div>
      </motion.div>
    </div>
  );

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesView = recipeView === 'all' || (recipeView === 'favorites' && recipe.isFavorite);
    const matchesCategory = filterCategories.length === 0 || filterCategories.every(cat => recipe.categories.includes(cat));
    const matchesAuthor = filterAuthors.length === 0 || filterAuthors.includes(recipe.author || '');
    
    const matchesProgram = filterPrograms.length === 0 || filterPrograms.some(progName => {
      const program = programs.find(p => p.name === progName);
      if (!program) return false;
      const allRecipeIdsInProgram = [
        ...program.recipeIds,
        ...(program.subfolders?.flatMap(sf => sf.recipeIds) || [])
      ];
      return allRecipeIdsInProgram.includes(recipe.id);
    });

    const timeValue = parseInt(recipe.time) || 0;
    const matchesTime = timeValue <= filterMaxTime;
    const matchesCalories = recipe.macros.calories <= filterMaxCalories;
    
    return matchesSearch && matchesView && matchesCategory && matchesAuthor && matchesProgram && matchesTime && matchesCalories;
  }).sort((a, b) => {
    if (filterSortBy === 'newest') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    if (filterSortBy === 'oldest') return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    if (filterSortBy === 'time') return (parseInt(a.time) || 0) - (parseInt(b.time) || 0);
    if (filterSortBy === 'calories') return a.macros.calories - b.macros.calories;
    return 0;
  });

  const categories = availableCategories;
  const allAuthors = Array.from(new Set(recipes.map(r => r.author || '').filter(Boolean))).sort();
  const allPrograms = programs.map(p => p.name).sort();

  const toggleFilterCategory = (cat: string) => {
    setFilterCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleFilterAuthor = (author: string) => {
    setFilterAuthors(prev => 
      prev.includes(author) ? prev.filter(a => a !== author) : [...prev, author]
    );
  };

  const toggleFilterProgram = (progName: string) => {
    setFilterPrograms(prev => 
      prev.includes(progName) ? prev.filter(p => p !== progName) : [...prev, progName]
    );
  };

  const addCategory = () => {
    setIsCategoryModalOpen(true);
  };

  const handleCreateCategory = () => {
    const newCat = newCategoryInput.trim();
    if (newCat && !availableCategories.includes(newCat)) {
      setAvailableCategories(prev => [...prev, newCat]);
      setNewCategoryInput('');
      setIsCategoryModalOpen(false);
    }
  };

  const removeCategory = (cat: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCategoryToDelete(cat);
    setIsCategoryDeleteConfirmOpen(true);
  };

  const confirmRemoveCategory = () => {
    if (categoryToDelete) {
      setAvailableCategories(prev => prev.filter(c => c !== categoryToDelete));
      setFilterCategories(prev => prev.filter(c => c !== categoryToDelete));
      setIsCategoryDeleteConfirmOpen(false);
      setCategoryToDelete(null);
    }
  };

  const renderRecipeList = () => (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:block w-64 flex-shrink-0 space-y-8 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto pr-2 custom-scrollbar">
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-4">Библиотека</h3>
          <SidebarItem 
            active={recipeView === 'all'} 
            onClick={() => setRecipeView('all')} 
            icon={<BookOpen className="w-5 h-5" />} 
            label="Все рецепты" 
            count={recipes.length}
          />
          <SidebarItem 
            active={recipeView === 'favorites'} 
            onClick={() => setRecipeView('favorites')} 
            icon={<Activity className="w-5 h-5" />} 
            label="Избранное" 
            count={recipes.filter(r => r.isFavorite).length}
          />
        </div>

        <div className="space-y-4 px-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Категории</h3>
            <button 
              onClick={addCategory}
              className="p-1 hover:bg-zinc-100 rounded-md text-emerald-600 transition-colors"
              title="Добавить категорию"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => toggleFilterCategory(cat)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-2",
                  filterCategories.includes(cat) ? "bg-emerald-600 border-emerald-600 text-white" : "bg-zinc-50 border-zinc-100 text-zinc-500 hover:border-emerald-200"
                )}
              >
                {cat}
                {!['Завтрак', 'Обед', 'Ужин', 'Перекус', 'Десерт', 'Мясо', 'Рыба', 'Веган', 'Вегетарианское', 'Напитки', 'Основное блюдо', 'Гарниры', 'Салаты', 'Супы'].includes(cat) && (
                  <Trash2 
                    className="w-3 h-3 opacity-50 hover:opacity-100" 
                    onClick={(e) => removeCategory(cat, e)}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Авторы</label>
            <select 
              className="w-full p-2 rounded-xl border border-zinc-200 text-xs font-bold bg-zinc-50 focus:ring-2 focus:ring-emerald-500 outline-none"
              value={filterAuthors[0] || ''}
              onChange={(e) => {
                const val = e.target.value;
                setFilterAuthors(val ? [val] : []);
              }}
            >
              <option value="">Все авторы</option>
              {allAuthors.map(author => (
                <option key={author} value={author}>{author}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Программы</label>
            <select 
              className="w-full p-2 rounded-xl border border-zinc-200 text-xs font-bold bg-zinc-50 focus:ring-2 focus:ring-emerald-500 outline-none"
              value={filterPrograms[0] || ''}
              onChange={(e) => {
                const val = e.target.value;
                setFilterPrograms(val ? [val] : []);
              }}
            >
              <option value="">Все программы</option>
              {allPrograms.map(prog => (
                <option key={prog} value={prog}>{prog}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-zinc-600">Время (до {filterMaxTime} мин)</label>
            </div>
            <input 
              type="range" 
              min="5" 
              max="120" 
              step="5"
              value={filterMaxTime}
              onChange={(e) => setFilterMaxTime(parseInt(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-zinc-600">Калории (до {filterMaxCalories})</label>
            </div>
            <input 
              type="range" 
              min="100" 
              max="1000" 
              step="50"
              value={filterMaxCalories}
              onChange={(e) => setFilterMaxCalories(parseInt(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>
        </div>
      </aside>

      {/* Main Grid Area */}
      <div className="flex-1 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold font-display">
              {recipeView === 'all' ? 'Все рецепты' : recipeView === 'favorites' ? 'Избранное' : 'Сборники'}
            </h2>
            <p className="text-zinc-500 text-sm">Найдено: {filteredRecipes.length}</p>
          </div>
        </div>
        
        {filteredRecipes.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400">
              <Search className="w-8 h-8" />
            </div>
            <p className="text-zinc-500">Ничего не найдено по вашим критериям</p>
            <button 
              onClick={() => {
                setSearchQuery('');
                setFilterCategories([]);
                setFilterAuthors([]);
                setFilterPrograms([]);
                setFilterMaxTime(120);
                setFilterMaxCalories(1000);
              }}
              className="text-emerald-600 font-bold hover:underline"
            >
              Сбросить фильтры
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {filteredRecipes.map((recipe) => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                key={recipe.id} 
                                                onClick={() => {
                                                  if (isRecipeSelectionMode) {
                                                    setSelectedRecipeIds(prev => 
                                                      prev.includes(recipe.id) ? prev.filter(id => id !== recipe.id) : [...prev, recipe.id]
                                                    );
                                                  } else {
                                                    const allergens = userProfile.allergies.filter(allergy => 
                                                      recipe.ingredients.some(ing => ing.toLowerCase().includes(allergy.toLowerCase()))
                                                    );
                                                    if (allergens.length > 0) {
                                                      alert(`ВНИМАНИЕ! Этот рецепт содержит ваши аллергены: ${allergens.join(', ')}`);
                                                    }
                                                    setSelectedRecipe(recipe);
                                                  }
                                                }}
                                                className={cn(
                                                  "bg-white rounded-2xl border overflow-hidden hover:shadow-xl transition-all group cursor-pointer flex flex-col h-full relative",
                                                  isRecipeSelectionMode && selectedRecipeIds.includes(recipe.id) ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-zinc-200"
                                                )}
                                                draggable={!isRecipeSelectionMode}
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
                {isRecipeSelectionMode && (
                  <div className="absolute top-3 left-3 z-20">
                    <div className={cn(
                      "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                      selectedRecipeIds.includes(recipe.id) ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white/80 border-zinc-300 text-transparent"
                    )}>
                      <Check className="w-4 h-4" />
                    </div>
                  </div>
                )}
                <div className="aspect-[4/3] bg-zinc-100 relative overflow-hidden">
                  <img 
                    src={recipe.image || `https://picsum.photos/seed/${recipe.id}/600/450`} 
                    alt={recipe.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button 
                      onClick={(e) => toggleFavorite(recipe.id, e)}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all",
                        recipe.isFavorite ? "bg-red-500 text-white" : "bg-white/80 text-zinc-400 hover:text-red-500"
                      )}
                    >
                      <Activity className={cn("w-4 h-4", recipe.isFavorite && "fill-current")} />
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-2">
                    <div className="flex flex-col items-center leading-none">
                      <span className="text-[10px] opacity-70">Ккал</span>
                      <div className="flex items-center gap-1">
                        <span>{recipe.macros.calories}</span>
                        {userProfile.allergies.some(allergy => 
                          recipe.ingredients.some(ing => ing.toLowerCase().includes(allergy.toLowerCase()))
                        ) && (
                          <span className="text-red-500 font-black text-xs">!</span>
                        )}
                      </div>
                    </div>
                    <div className="w-px h-4 bg-white/20" />
                    <div className="flex flex-col items-center leading-none">
                      <span className="text-[10px] opacity-70">Б</span>
                      <span>{recipe.macros.proteins}</span>
                    </div>
                    <div className="w-px h-4 bg-white/20" />
                    <div className="flex flex-col items-center leading-none">
                      <span className="text-[10px] opacity-70">Ж</span>
                      <span>{recipe.macros.fats}</span>
                    </div>
                    <div className="w-px h-4 bg-white/20" />
                    <div className="flex flex-col items-center leading-none">
                      <span className="text-[10px] opacity-70">У</span>
                      <span>{recipe.macros.carbs}</span>
                    </div>
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex flex-wrap gap-1 mb-3">
                    {recipe.categories.slice(0, 3).map(cat => (
                      <span key={cat} className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md">
                        {cat}
                      </span>
                    ))}
                  </div>
                  <h3 className="font-bold text-lg mb-4 group-hover:text-emerald-600 transition-colors line-clamp-2 leading-snug flex items-center justify-between gap-2">
                    {recipe.title}
                    {userProfile.allergies.some(allergy => 
                      recipe.ingredients.some(ing => ing.toLowerCase().includes(allergy.toLowerCase()))
                    ) && (
                      <span title="Содержит аллергены!">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    </span>
                    )}
                  </h3>
                  <div className="mt-auto pt-4 border-t border-zinc-100 flex items-center justify-between text-zinc-500 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-500" />
                      <span className="font-medium">{recipe.time}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-500" />
                      <span className="font-medium">{recipe.servings} порц.</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

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

  const renderCart = () => {
    const handleAddManualCartItem = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newCartItemName.trim()) return;
      
      const BASIC_KEYWORDS = ['соль', 'сахар', 'перец', 'лук', 'чеснок', 'масло', 'мука', 'сода', 'уксус', 'вода', 'специи', 'приправа'];
      const isBasic = BASIC_KEYWORDS.some(k => newCartItemName.toLowerCase().includes(k));

      await addDoc(collection(db, "cart"), {
        name: newCartItemName,
        amount: newCartItemAmount,
        sourceDishes: [],
        checked: false,
        isBasic,
        createdAt: new Date().toISOString()
      });
      
      setNewCartItemName('');
      setNewCartItemAmount('');
    };

    const toggleCartItem = async (item: CartItem) => {
      await updateDoc(doc(db, "cart", item.id), { checked: !item.checked });
    };

    const deleteCartItem = async (id: string) => {
      await deleteDoc(doc(db, "cart", id));
    };

    const updateCartItemAmount = async (id: string, amount: string) => {
      await updateDoc(doc(db, "cart", id), { amount });
    };

    const basicItems = cart.filter(item => item.isBasic);
    const mainItems = cart.filter(item => !item.isBasic);

    const CartItemRow = ({ item, isBasic = false }: { item: CartItem, isBasic?: boolean }) => (
      <div className={cn(
        "p-3 flex items-center gap-3 hover:bg-zinc-50/50 transition-colors group",
        item.checked && "opacity-50"
      )}>
        <button 
          onClick={() => toggleCartItem(item)}
          className={cn(
            "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0",
            item.checked ? "bg-emerald-500 border-emerald-500 text-white" : isBasic ? "border-emerald-200 text-transparent" : "border-zinc-200 text-transparent"
          )}
        >
          <Check className="w-3 h-3" />
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={cn("font-bold text-sm text-zinc-900", item.checked && "line-through")}>
              {item.name}
            </span>
            <span className={cn("text-xs font-medium", isBasic ? "text-emerald-600/60" : "text-zinc-400")}>
              {isBasic ? `Нужно: ${item.amount}` : item.amount}
            </span>
          </div>
          {item.sourceDishes && item.sourceDishes.length > 0 && (
            <p className="text-[10px] text-zinc-400 truncate italic">
              ({item.sourceDishes.join(', ')})
            </p>
          )}
          {isBasic && !item.checked && (
            <p className="text-[10px] text-emerald-600/40 font-medium">Есть в наличии или докупить?</p>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isBasic && (
            <button 
              onClick={() => {
                const newAmount = prompt('Изменить количество:', item.amount);
                if (newAmount !== null) updateCartItemAmount(item.id, newAmount);
              }}
              className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button 
            onClick={() => deleteCartItem(item.id)}
            className="p-1.5 hover:bg-red-50 rounded-lg text-zinc-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );

    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-24">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold font-display mb-1">Корзина</h2>
            <p className="text-sm text-zinc-500">Список покупок для ваших рецептов</p>
          </div>
          <button 
            onClick={async () => {
              if (confirm('Очистить всю корзину?')) {
                for (const item of cart) {
                  await deleteDoc(doc(db, "cart", item.id));
                }
              }
            }}
            className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
          >
            Очистить все
          </button>
        </div>

        <form onSubmit={handleAddManualCartItem} className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm flex gap-3">
          <div className="flex-1">
            <input 
              type="text" 
              placeholder="Название продукта..."
              value={newCartItemName}
              onChange={(e) => setNewCartItemName(e.target.value)}
              className="w-full bg-zinc-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div className="w-24">
            <input 
              type="text" 
              placeholder="Кол-во..."
              value={newCartItemAmount}
              onChange={(e) => setNewCartItemAmount(e.target.value)}
              className="w-full bg-zinc-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <button 
            type="submit"
            className="bg-emerald-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить</span>
          </button>
        </form>

        {cart.length === 0 ? (
          <div className="bg-white rounded-3xl border border-zinc-100 p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto">
              <ShoppingCart className="w-8 h-8 text-zinc-200" />
            </div>
            <p className="text-zinc-500 text-sm">Ваша корзина пуста. Добавьте продукты вручную или из планировщика.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {mainItems.length > 0 && (
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-zinc-50/50 border-b border-zinc-100">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Основные продукты</h3>
                </div>
                <div className="divide-y divide-zinc-50">
                  {mainItems.map((item) => <CartItemRow key={item.id} item={item} />)}
                </div>
              </div>
            )}

            {basicItems.length > 0 && (
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-emerald-50/30 border-b border-emerald-100">
                  <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Базовые продукты (Проверьте наличие)</h3>
                </div>
                <div className="divide-y divide-zinc-50">
                  {basicItems.map((item) => <CartItemRow key={item.id} item={item} isBasic />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'recipes':
        return recipes.length === 0 ? renderEmptyState() : renderRecipeList();
      case 'planner':
        return renderPlanner();
      case 'cart':
        return renderCart();
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
                            const isEditing = editingSubfolderId === subfolder.id;

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

        {isSettingsOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-600">
                    <Settings className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-zinc-900">Настройки профиля</h2>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase">Имя</label>
                    <input 
                      type="text"
                      value={userProfile.name}
                      onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Ваше имя"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase">Возраст</label>
                    <input 
                      type="number"
                      value={userProfile.age}
                      onChange={(e) => setUserProfile({...userProfile, age: parseInt(e.target.value)})}
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase">Пол</label>
                    <select 
                      value={userProfile.gender}
                      onChange={(e) => setUserProfile({...userProfile, gender: e.target.value as 'male' | 'female'})}
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="female">Женский</option>
                      <option value="male">Мужской</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase">Текущий вес (кг)</label>
                    <input 
                      type="number"
                      value={userProfile.currentWeight}
                      onChange={(e) => setUserProfile({...userProfile, currentWeight: parseFloat(e.target.value)})}
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase">Желаемый вес (кг)</label>
                    <input 
                      type="number"
                      value={userProfile.targetWeight}
                      onChange={(e) => setUserProfile({...userProfile, targetWeight: parseFloat(e.target.value)})}
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-2">Цели КБЖУ</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Ккал</label>
                      <input 
                        type="number"
                        value={userProfile.targetCalories}
                        onChange={(e) => setUserProfile({...userProfile, targetCalories: parseInt(e.target.value)})}
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Белки (г)</label>
                      <input 
                        type="number"
                        value={userProfile.targetProteins}
                        onChange={(e) => setUserProfile({...userProfile, targetProteins: parseInt(e.target.value)})}
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Жиры (г)</label>
                      <input 
                        type="number"
                        value={userProfile.targetFats}
                        onChange={(e) => setUserProfile({...userProfile, targetFats: parseInt(e.target.value)})}
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Углеводы (г)</label>
                      <input 
                        type="number"
                        value={userProfile.targetCarbs}
                        onChange={(e) => setUserProfile({...userProfile, targetCarbs: parseInt(e.target.value)})}
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-2">Аллергии и непереносимости</h3>
                  <div className="flex flex-wrap gap-2">
                    {['Глютен', 'Лактоза', 'Орехи', 'Морепродукты', 'Яйца', 'Соя', 'Мед', 'Цитрусовые'].map(allergy => (
                      <button
                        key={allergy}
                        onClick={() => {
                          const newAllergies = userProfile.allergies.includes(allergy)
                            ? userProfile.allergies.filter(a => a !== allergy)
                            : [...userProfile.allergies, allergy];
                          setUserProfile({ ...userProfile, allergies: newAllergies });
                        }}
                        className={cn(
                          "px-4 py-2 rounded-xl text-sm font-medium transition-all border",
                          userProfile.allergies.includes(allergy)
                            ? "bg-red-50 border-red-200 text-red-600 shadow-sm"
                            : "bg-zinc-50 border-zinc-100 text-zinc-500 hover:border-red-100"
                        )}
                      >
                        {allergy}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      id="custom-allergy-input"
                      type="text"
                      placeholder="Добавить свою..."
                      className="flex-1 bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val && !userProfile.allergies.includes(val)) {
                            setUserProfile({ ...userProfile, allergies: [...userProfile.allergies, val] });
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                    <button 
                      onClick={() => {
                        const input = document.getElementById('custom-allergy-input') as HTMLInputElement;
                        const val = input.value.trim();
                        if (val && !userProfile.allergies.includes(val)) {
                          setUserProfile({ ...userProfile, allergies: [...userProfile.allergies, val] });
                          input.value = '';
                        }
                      }}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all"
                    >
                      Добавить
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                    <h3 className="text-sm font-bold text-zinc-900">Управление категориями</h3>
                    <button 
                      onClick={() => setIsCategoryModalOpen(true)}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Добавить
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableCategories.map(cat => (
                      <div
                        key={cat}
                        className={cn(
                          "group flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all border bg-zinc-50 border-zinc-100 text-zinc-600"
                        )}
                      >
                        <span>{cat}</span>
                        {!['Завтрак', 'Обед', 'Ужин', 'Перекус', 'Десерт', 'Мясо', 'Рыба', 'Веган', 'Вегетарианское', 'Напитки', 'Основное блюдо', 'Гарниры', 'Салаты', 'Супы'].includes(cat) && (
                          <button 
                            onClick={(e) => removeCategory(cat, e)}
                            className="text-zinc-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                  <div className="flex items-center gap-3 mb-4">
                    <Droplets className="w-5 h-5 text-blue-600" />
                    <h3 className="text-sm font-bold text-blue-900">Калькулятор воды</h3>
                  </div>
                  <p className="text-sm text-blue-700 mb-4">
                    На основе вашего веса ({userProfile.currentWeight} кг) рекомендуемая норма воды:
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-blue-600">
                      {Math.round(userProfile.currentWeight * 35)} мл
                    </span>
                    <button 
                      onClick={() => setUserProfile({...userProfile, waterGoal: Math.round(userProfile.currentWeight * 35)})}
                      className="text-xs font-bold bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all"
                    >
                      Установить как цель
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-zinc-100 bg-zinc-50">
                <button 
                  onClick={handleSaveSettings}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Сохранить настройки
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Новая категория</h3>
                <button onClick={() => setIsCategoryModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase">Название</label>
                  <input 
                    autoFocus
                    type="text"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Например: Праздничное"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button 
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all"
                  >
                    Отмена
                  </button>
                  <button 
                    onClick={handleCreateCategory}
                    disabled={!newCategoryInput.trim()}
                    className="py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:shadow-none"
                  >
                    Создать
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Точно удалить?</h3>
              <p className="text-zinc-500 text-sm mb-8">Это действие нельзя будет отменить. Рецепт будет удален навсегда.</p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all"
                >
                  Отмена
                </button>
                <button 
                  onClick={async () => {
                    if (selectedRecipe) {
                      try {
                        await deleteDoc(doc(db, "recipes", selectedRecipe.id));
                        setSelectedRecipe(null);
                        setIsDeleteConfirmOpen(false);
                      } catch (error) {
                        console.error("Error deleting recipe:", error);
                        alert("Ошибка при удалении рецепта");
                      }
                    }
                  }}
                  className="py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100"
                >
                  Удалить
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isCategoryDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryDeleteConfirmOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Удалить категорию?</h3>
              <p className="text-zinc-500 text-sm mb-8">Вы уверены, что хотите удалить категорию "{categoryToDelete}"?</p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setIsCategoryDeleteConfirmOpen(false)}
                  className="py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all"
                >
                  Отмена
                </button>
                <button 
                  onClick={confirmRemoveCategory}
                  className="py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100"
                >
                  Удалить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isScanning && !isAddingManual && !isAddingPDF && !isAddingLink && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center gap-4"
          >
            <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
            <div className="text-center">
              <h3 className="text-xl font-bold text-zinc-900">Анализирую рецепт...</h3>
              <p className="text-zinc-500">Это займет всего несколько секунд</p>
            </div>
          </motion.div>
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
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Поиск рецептов..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
              />
            </div>

            {/* View Filter */}
            <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
              <button 
                onClick={() => setRecipeView('all')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  recipeView === 'all' ? "bg-white shadow-sm text-emerald-600" : "text-zinc-500"
                )}
              >
                Все
              </button>
              <button 
                onClick={() => setRecipeView('favorites')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  recipeView === 'favorites' ? "bg-white shadow-sm text-emerald-600" : "text-zinc-500"
                )}
              >
                Избранное
              </button>
            </div>

            {/* Filter Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all font-bold border text-sm",
                  isFilterOpen || filterCategories.length > 0 || filterAuthors.length > 0 || filterPrograms.length > 0 || filterMaxTime < 120 || filterMaxCalories < 1000
                    ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                    : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                )}
              >
                <Filter className="w-4 h-4" />
                <span>Фильтр</span>
                {(filterCategories.length > 0 || filterAuthors.length > 0 || filterPrograms.length > 0 || filterMaxTime < 120 || filterMaxCalories < 1000) && (
                  <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                )}
              </button>

              <AnimatePresence>
                {isFilterOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-30" 
                      onClick={() => setIsFilterOpen(false)}
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-zinc-100 p-5 z-40 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar"
                    >
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Сортировка</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => setFilterSortBy('newest')}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                              filterSortBy === 'newest' ? "bg-emerald-600 border-emerald-600 text-white" : "bg-zinc-50 border-zinc-100 text-zinc-500 hover:border-emerald-200"
                            )}
                          >
                            Сначала новые
                          </button>
                          <button 
                            onClick={() => setFilterSortBy('oldest')}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                              filterSortBy === 'oldest' ? "bg-emerald-600 border-emerald-600 text-white" : "bg-zinc-50 border-zinc-100 text-zinc-500 hover:border-emerald-200"
                            )}
                          >
                            Сначала старые
                          </button>
                          <button 
                            onClick={() => setFilterSortBy('time')}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                              filterSortBy === 'time' ? "bg-emerald-600 border-emerald-600 text-white" : "bg-zinc-50 border-zinc-100 text-zinc-500 hover:border-emerald-200"
                            )}
                          >
                            По времени
                          </button>
                          <button 
                            onClick={() => setFilterSortBy('calories')}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                              filterSortBy === 'calories' ? "bg-emerald-600 border-emerald-600 text-white" : "bg-zinc-50 border-zinc-100 text-zinc-500 hover:border-emerald-200"
                            )}
                          >
                            По калориям
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Категория</label>
                          <button 
                            onClick={addCategory}
                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Категория
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {categories.map(cat => (
                            <button 
                              key={cat}
                              onClick={() => toggleFilterCategory(cat)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-2",
                                filterCategories.includes(cat) ? "bg-emerald-600 border-emerald-600 text-white" : "bg-zinc-50 border-zinc-100 text-zinc-500 hover:border-emerald-200"
                              )}
                            >
                              {cat}
                              {!['Завтрак', 'Обед', 'Ужин', 'Перекус', 'Десерт', 'Мясо', 'Рыба', 'Веган', 'Вегетарианское', 'Напитки', 'Основное блюдо', 'Гарниры', 'Салаты', 'Супы'].includes(cat) && (
                                <Trash2 
                                  className="w-3 h-3 opacity-50 hover:opacity-100" 
                                  onClick={(e) => removeCategory(cat, e)}
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Авторы</label>
                        <select 
                          className="w-full p-2.5 rounded-xl border border-zinc-200 text-sm font-bold bg-zinc-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={filterAuthors[0] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFilterAuthors(val ? [val] : []);
                          }}
                        >
                          <option value="">Все авторы</option>
                          {allAuthors.map(author => (
                            <option key={author} value={author}>{author}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Программы</label>
                        <select 
                          className="w-full p-2.5 rounded-xl border border-zinc-200 text-sm font-bold bg-zinc-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={filterPrograms[0] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFilterPrograms(val ? [val] : []);
                          }}
                        >
                          <option value="">Все программы</option>
                          {allPrograms.map(prog => (
                            <option key={prog} value={prog}>{prog}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Время</label>
                          <span className="text-xs font-bold text-emerald-600">{filterMaxTime} мин</span>
                        </div>
                        <input 
                          type="range" min="5" max="120" step="5"
                          value={filterMaxTime}
                          onChange={(e) => setFilterMaxTime(parseInt(e.target.value))}
                          className="w-full accent-emerald-600"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Калории</label>
                          <span className="text-xs font-bold text-emerald-600">{filterMaxCalories}</span>
                        </div>
                        <input 
                          type="range" min="100" max="1000" step="50"
                          value={filterMaxCalories}
                          onChange={(e) => setFilterMaxCalories(parseInt(e.target.value))}
                          className="w-full accent-emerald-600"
                        />
                      </div>

                      <button 
                        onClick={() => {
                          setFilterCategories([]);
                          setFilterAuthors([]);
                          setFilterPrograms([]);
                          setFilterMaxTime(120);
                          setFilterMaxCalories(1000);
                        }}
                        className="w-full py-2 text-xs font-bold text-zinc-400 hover:text-red-500 transition-colors border-t border-zinc-50 pt-4"
                      >
                        Сбросить всё
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Add Recipe Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsAddRecipeDropdownOpen(!isAddRecipeDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить рецепт</span>
              </button>

              <AnimatePresence>
                {isAddRecipeDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsAddRecipeDropdownOpen(false)}
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden z-50"
                    >
                      <AddRecipeOption 
                        icon={<Camera className="w-4 h-4 text-emerald-500" />} 
                        label="Загрузить фото" 
                        onClick={() => { photoInputRef.current?.click(); setIsAddRecipeDropdownOpen(false); }}
                      />
                      <AddRecipeOption 
                        icon={<FileText className="w-4 h-4 text-emerald-500" />} 
                        label="PDF документ" 
                        onClick={() => { setIsAddingPDF(true); setIsAddRecipeDropdownOpen(false); }}
                      />
                      <AddRecipeOption 
                        icon={<LinkIcon className="w-4 h-4 text-emerald-500" />} 
                        label="Вставить ссылку" 
                        onClick={() => { setIsAddingLink(true); setIsAddRecipeDropdownOpen(false); }}
                      />
                      <AddRecipeOption 
                        icon={<Edit3 className="w-4 h-4 text-emerald-500" />} 
                        label="Добавить вручную" 
                        onClick={() => { setIsAddingManual(true); setIsAddRecipeDropdownOpen(false); }}
                      />
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
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

      {/* Hidden Photo Input */}
      <input 
        type="file" 
        ref={photoInputRef}
        accept="image/*" 
        multiple
        className="hidden" 
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) {
            const imagePromises = files.map(file => {
              return new Promise<{base64: string, mimeType: string}>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  resolve({ base64: reader.result as string, mimeType: file.type });
                };
                reader.readAsDataURL(file);
              });
            });
            const images = await Promise.all(imagePromises);
            await analyzePhoto(images, true);
          }
        }}
      />

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

      {/* Product Add Modal (Recipe) */}
      <AnimatePresence>
        {isAddingProductToRecipe && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingProductToRecipe(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Добавить продукт в рецепт</h3>
                <button onClick={() => setIsAddingProductToRecipe(false)} className="text-zinc-400 hover:text-zinc-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddProductToRecipe} className="space-y-6">
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
                  Добавить в рецепт и рассчитать КБЖУ
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PDF Add Modal */}
      <AnimatePresence>
        {isAddingPDF && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isScanning && setIsAddingPDF(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8 text-center"
            >
              {isScanning && (
                <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                  <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
                  <p className="text-sm font-bold text-zinc-900">Анализирую PDF...</p>
                </div>
              )}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">PDF документ</h3>
                <button onClick={() => setIsAddingPDF(false)} className="text-zinc-400 hover:text-zinc-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="py-12 space-y-4">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10" />
                </div>
                <p className="text-zinc-600">Загрузите PDF файл с рецептом для автоматического анализа.</p>
                <label className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 cursor-pointer block">
                  Выбрать файл
                  <input 
                    type="file" 
                    accept="application/pdf" 
                    className="hidden" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setIsScanning(true);
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const base64 = (reader.result as string).split(',')[1] ?? '';
                          try {
                            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
                            const response = await ai.models.generateContent({
                              model: "gemini-3-flash-preview",
                              contents: [
                                {
                                  inlineData: {
                                    mimeType: "application/pdf",
                                    data: base64
                                  }
                                },
                                {
                                  text: `Extract ALL recipe details from this PDF. If there are multiple recipes, return them all. Return structured data in Russian. 
                                  Include title, ingredients (as a single string with newlines), steps (as a single string with newlines), time, calories, proteins, fats, carbs, servings.
                                  ВАЖНО: Если КБЖУ (калории, белки, жиры, углеводы) не указаны в документе явно, ПОЖАЛУЙСТА, РАССЧИТАЙТЕ ИХ самостоятельно на основе ингредиентов и их количества.
                                  Include 'author' if mentioned in the document.
                                  For each recipe, provide the 'pageNumber' (1-indexed) and 'dishBoundingBox' [ymin, xmin, ymax, xmax] for the main photo associated with that recipe. Use normalized coordinates (0-1000).
                                  For categories, ONLY choose from this list: ${availableCategories.join(', ')}.`
                                }
                              ],
                              config: {
                                responseMimeType: "application/json",
                                responseSchema: {
                                  type: Type.OBJECT,
                                  properties: {
                                    recipes: {
                                      type: Type.ARRAY,
                                      items: {
                                        type: Type.OBJECT,
                                        properties: {
                                          title: { type: Type.STRING },
                                          author: { type: Type.STRING },
                                          ingredients: { type: Type.STRING },
                                          steps: { type: Type.STRING },
                                          time: { type: Type.STRING },
                                          calories: { type: Type.NUMBER },
                                          proteins: { type: Type.NUMBER },
                                          fats: { type: Type.NUMBER },
                                          carbs: { type: Type.NUMBER },
                                          categories: { type: Type.ARRAY, items: { type: Type.STRING } },
                                          servings: { type: Type.NUMBER },
                                          sourceUrl: { type: Type.STRING },
                                          pageNumber: { type: Type.NUMBER },
                                          dishBoundingBox: {
                                            type: Type.OBJECT,
                                            properties: {
                                              ymin: { type: Type.NUMBER },
                                              xmin: { type: Type.NUMBER },
                                              ymax: { type: Type.NUMBER },
                                              xmax: { type: Type.NUMBER }
                                            }
                                          }
                                        },
                                        required: ["title", "ingredients", "steps", "time", "calories", "proteins", "fats", "carbs", "categories", "servings"]
                                      }
                                    }
                                  },
                                  required: ["recipes"]
                                }
                              }
                            });

                            const result = JSON.parse(response.text || '{"recipes":[]}');
                            const recipesToProcess = result.recipes || [];

                            for (const data of recipesToProcess) {
                              let dishImage = '';
                              if (data.pageNumber && data.dishBoundingBox) {
                                dishImage = await extractImageFromPDF(base64, data.pageNumber, data.dishBoundingBox);
                              }

                              if (!dishImage) {
                                const generated = await generateRecipeImage(data.title || 'Новый рецепт', (data.ingredients || '').split('\n'));
                                if (generated) dishImage = generated;
                              }

                              const recipeToSave = {
                                title: data.title || 'Новый рецепт',
                                author: data.author || '',
                                sourceUrl: data.sourceUrl || '',
                                image: dishImage || null,
                                time: data.time || '30 мин',
                                servings: data.servings || 2,
                                categories: (data.categories || []).filter((c: string) => availableCategories.includes(c.toLowerCase())),
                                ingredients: (data.ingredients || '').split('\n').map((s: string) => s.trim()).filter(Boolean),
                                steps: (data.steps || '').split('\n').map((s: string) => s.trim()).filter(Boolean),
                                macros: {
                                  calories: data.calories || 0,
                                  proteins: data.proteins || 0,
                                  fats: data.fats || 0,
                                  carbs: data.carbs || 0
                                },
                                isFavorite: false
                              };

                              const docRef = await addDoc(collection(db, "recipes"), {
                                ...recipeToSave,
                                createdAt: new Date().toISOString()
                              });
                              if (recipeTarget) {
                                await addRecipeToTarget(docRef.id);
                              }
                            }

                            setIsAddingPDF(false);
                            alert(`Успешно добавлено рецептов: ${recipesToProcess.length}`);
                          } catch (error) {
                            console.error("Error analyzing PDF:", error);
                            alert("Не удалось распознать PDF. Попробуйте другой файл.");
                          } finally {
                            setIsScanning(false);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Link Add Modal */}
      <AnimatePresence>
        {isAddingLink && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isScanning && setIsAddingLink(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Импорт по ссылке</h3>
                <button 
                  onClick={() => setIsAddingLink(false)} 
                  disabled={isScanning}
                  className="text-zinc-400 hover:text-zinc-600 disabled:opacity-50"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleLinkSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700 font-bold">URL адрес рецепта</label>
                  <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <input 
                      required
                      type="url" 
                      value={recipeLink}
                      onChange={(e) => setRecipeLink(e.target.value)}
                      disabled={isScanning}
                      className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm disabled:opacity-50"
                      placeholder="https://example.com/recipe or youtube.com/..."
                    />
                  </div>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Поддерживаются ссылки на сайты и видео</p>
                </div>

                <button 
                  type="submit"
                  disabled={isScanning || !recipeLink.trim()}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Сканирую...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      <span>Добавить рецепт</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAddingManual && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingManual(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {isScanning && (
                <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
                  <div className="text-center">
                    <p className="text-lg font-bold text-zinc-900">Анализирую фото...</p>
                    <p className="text-sm text-zinc-500">Наш ИИ считывает ингредиенты и шаги</p>
                  </div>
                </div>
              )}
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">{editingId ? 'Редактировать рецепт' : 'Новый рецепт'}</h3>
                <button onClick={() => {
                  setIsAddingManual(false);
                  setEditingId(null);
                }} className="text-zinc-400 hover:text-zinc-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
                           <form onSubmit={handleAddManual} className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* 1. Title */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1 font-bold">Название блюда *</label>
                  <input 
                    required
                    type="text" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-lg font-medium"
                    placeholder="Например: Паста Карбонара"
                  />
                </div>

                {/* Source Link */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1 font-bold">Ссылка на источник</label>
                  <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      type="url" 
                      value={formData.sourceUrl}
                      onChange={(e) => setFormData({...formData, sourceUrl: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* 2. Photo Upload */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-zinc-700 font-bold">Фотография блюда</label>
                    {formData.image && !isScanning && (
                      <button 
                        type="button"
                        onClick={() => analyzePhoto([{ base64: formData.image!, mimeType: 'image/jpeg' }], false)}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
                      >
                        <Activity className="w-3 h-3" />
                        Распознать текст ИИ
                      </button>
                    )}
                  </div>
                  <label className="w-full aspect-video bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-3xl flex flex-col items-center justify-center gap-3 group hover:border-emerald-300 hover:bg-emerald-50/30 transition-all cursor-pointer overflow-hidden relative">
                    {formData.image ? (
                      <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-zinc-400 group-hover:text-emerald-600 group-hover:scale-110 transition-all">
                          <Camera className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-zinc-500 group-hover:text-emerald-700">Нажмите для загрузки</p>
                          <p className="text-[10px] text-zinc-400 uppercase tracking-wider mt-1">JPG, PNG до 5MB</p>
                        </div>
                      </>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setFormData({ ...formData, image: reader.result as string });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>

                {/* 3. Ingredients */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-zinc-700 font-bold">Ингредиенты</label>
                      <div className="flex items-center gap-2">
                        <button 
                          type="button"
                          onClick={async () => {
                            if (!formData.ingredients.trim()) {
                              alert("Сначала введите ингредиенты");
                              return;
                            }
                            setIsScanning(true);
                            try {
                              const data = await aiClient.calculateKbzhu({ ingredients: formData.ingredients });
                              setFormData({
                                ...formData,
                                calories: data.calories || 0,
                                proteins: data.proteins || 0,
                                fats: data.fats || 0,
                                carbs: data.carbs || 0
                              });
                            } catch (e) {
                              console.error(e);
                              alert("Не удалось рассчитать КБЖУ. Проверьте ингредиенты.");
                            } finally {
                              setIsScanning(false);
                            }
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-lg transition-colors uppercase tracking-wider"
                        >
                          <Activity className="w-3 h-3" />
                          Рассчитать КБЖУ ИИ
                        </button>
                        <button 
                          type="button"
                          onClick={() => setIsAddingProductToRecipe(true)}
                          className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg transition-colors uppercase tracking-wider"
                        >
                          <Plus className="w-3 h-3" />
                          Добавить продукт с КБЖУ
                        </button>
                      </div>
                    </div>
                  <textarea 
                    rows={5}
                    placeholder="100г пасты&#10;2 яйца&#10;50г бекона..."
                    value={formData.ingredients}
                    onChange={(e) => setFormData({...formData, ingredients: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed"
                  />
                </div>

                {/* 4. Steps */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2 font-bold">Пошаговое приготовление (описание)</label>
                  <textarea 
                    rows={6}
                    placeholder="1. Отварите пасту...&#10;2. Обжарьте бекон..."
                    value={formData.steps}
                    onChange={(e) => setFormData({...formData, steps: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed"
                  />
                </div>

                {/* 5. Macros */}
                <div className="p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100/50">
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-bold text-emerald-900 uppercase tracking-wider">КБЖУ (на порцию)</label>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, calories: 0, proteins: 0, fats: 0, carbs: 0})}
                      className="text-[10px] font-bold text-zinc-400 hover:text-red-500 uppercase tracking-wider transition-colors"
                    >
                      Сбросить
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Ккал</label>
                      <input 
                        type="number" 
                        value={formData.calories}
                        onChange={(e) => setFormData({...formData, calories: parseInt(e.target.value)})}
                        className="w-full px-4 py-2 bg-white border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Белки (г)</label>
                      <input 
                        type="number" 
                        value={formData.proteins}
                        onChange={(e) => setFormData({...formData, proteins: parseInt(e.target.value)})}
                        className="w-full px-4 py-2 bg-white border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Жиры (г)</label>
                      <input 
                        type="number" 
                        value={formData.fats}
                        onChange={(e) => setFormData({...formData, fats: parseInt(e.target.value)})}
                        className="w-full px-4 py-2 bg-white border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Углеводы (г)</label>
                      <input 
                        type="number" 
                        value={formData.carbs}
                        onChange={(e) => setFormData({...formData, carbs: parseInt(e.target.value)})}
                        className="w-full px-4 py-2 bg-white border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" 
                      />
                    </div>
                  </div>
                </div>

                {/* 6. Others */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-3 font-bold">Категории</label>
                    <div className="flex flex-wrap gap-2">
                      {availableCategories.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            if (formData.categories.includes(cat)) {
                              setFormData({...formData, categories: formData.categories.filter(c => c !== cat)});
                            } else {
                              setFormData({...formData, categories: [...formData.categories, cat]});
                            }
                          }}
                          className={cn(
                            "px-4 py-2 rounded-2xl text-xs font-bold transition-all border",
                            formData.categories.includes(cat)
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100"
                              : "bg-white border-zinc-200 text-zinc-500 hover:border-emerald-300 hover:text-emerald-600"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1 font-bold">Время приготовления</label>
                      <input 
                        type="text" 
                        placeholder="30 мин"
                        value={formData.time}
                        onChange={(e) => setFormData({...formData, time: e.target.value})}
                        className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1 font-bold">Порции</label>
                      <input 
                        type="number" 
                        value={formData.servings}
                        onChange={(e) => setFormData({...formData, servings: parseInt(e.target.value)})}
                        className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1 font-bold">Замена ингредиентов / Советы</label>
                    <textarea 
                      rows={3}
                      value={formData.substitutions}
                      onChange={(e) => setFormData({...formData, substitutions: e.target.value})}
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                  </div>
                </div>

                {/* 7. Author */}
                <div className="pt-4 border-t border-zinc-100">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1 font-bold">Автор / Создатель</label>
                    <input 
                      type="text" 
                      value={formData.author}
                      onChange={(e) => setFormData({...formData, author: e.target.value})}
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsAddingManual(false);
                      setEditingId(null);
                    }}
                    className="flex-1 px-4 py-4 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-colors text-zinc-600"
                  >
                    Отмена
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-colors shadow-xl shadow-emerald-100"
                  >
                    Сохранить рецепт
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recipe Detail Modal */}
      <AnimatePresence>
        {selectedRecipe && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedRecipe(null);
                setIsPlanning(false);
              }}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Header with Title and Close */}
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <h2 className="text-2xl font-bold font-display text-zinc-900">{selectedRecipe.title}</h2>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedRecipe.categories.map(cat => (
                      <span key={cat} className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                        {cat}
                      </span>
                    ))}
                    {selectedRecipe.sourceUrl && (
                      <a 
                        href={selectedRecipe.sourceUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-zinc-200 transition-colors"
                      >
                        <LinkIcon className="w-3 h-3" />
                        Источник
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      handleEdit(selectedRecipe);
                      setSelectedRecipe(null);
                    }}
                    className="w-10 h-10 bg-zinc-50 border border-zinc-100 text-zinc-400 rounded-full flex items-center justify-center hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                    title="Редактировать"
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => toggleFavorite(selectedRecipe.id)}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all border",
                      selectedRecipe.isFavorite ? "bg-red-50 border-red-100 text-red-500" : "bg-zinc-50 border-zinc-100 text-zinc-400 hover:text-red-500"
                    )}
                  >
                    <Activity className={cn("w-5 h-5", selectedRecipe.isFavorite && "fill-current")} />
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedRecipe(null);
                      setIsPlanning(false);
                    }}
                    className="w-10 h-10 bg-zinc-100 text-zinc-500 rounded-full flex items-center justify-center hover:bg-zinc-200 transition-colors"
                  >
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Photo Section */}
                <div className="relative h-64 sm:h-96 bg-zinc-100 group/photo">
                  <img 
                    src={selectedRecipe.image || `https://picsum.photos/seed/${selectedRecipe.id}/1200/800`} 
                    alt={selectedRecipe.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  
                  {isUpdatingImage && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-20">
                      <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/0 group-hover/photo:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover/photo:opacity-100">
                    <label className="bg-white px-6 py-3 rounded-2xl text-sm font-bold text-zinc-900 flex items-center gap-2 shadow-2xl cursor-pointer hover:scale-105 transition-all active:scale-95">
                      <Camera className="w-5 h-5 text-emerald-600" />
                      Изменить фото
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file && selectedRecipe) {
                            setIsUpdatingImage(true);
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const base64 = reader.result as string;
                              try {
                                await updateDoc(doc(db, "recipes", selectedRecipe.id), {
                                  image: base64
                                });
                                setSelectedRecipe({ ...selectedRecipe, image: base64 });
                                setShowSaveSuccess(true);
                                setTimeout(() => setShowSaveSuccess(false), 3000);
                              } catch (err) {
                                console.error("Error updating image:", err);
                                alert("Ошибка при обновлении фото");
                              } finally {
                                setIsUpdatingImage(false);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>

                  <AnimatePresence>
                    {showSaveSuccess && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 z-30 font-bold"
                      >
                        <Check className="w-5 h-5" />
                        Фото сохранено!
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="p-6 md:p-8 space-y-10">
                  {/* Action Buttons Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
                    <button 
                      onClick={() => setIsPlanning(!isPlanning)}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border transition-all gap-2",
                        isPlanning ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100" : "bg-white border-zinc-100 text-zinc-600 hover:bg-zinc-50"
                      )}
                    >
                      <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span className="text-[10px] sm:text-xs font-bold">В план</span>
                    </button>
                    <button 
                      onClick={() => setIsCollectionPickerOpen(!isCollectionPickerOpen)}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border transition-all gap-2",
                        isCollectionPickerOpen ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100" : "bg-white border-zinc-100 text-zinc-600 hover:bg-zinc-50"
                      )}
                    >
                      <FolderPlus className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span className="text-[10px] sm:text-xs font-bold">Сборники</span>
                    </button>
                    <button className="flex flex-col items-center justify-center p-3 sm:p-4 bg-white border border-zinc-100 rounded-2xl text-zinc-600 hover:bg-zinc-50 transition-all gap-2">
                      <Share2 className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span className="text-[10px] sm:text-xs font-bold">Поделиться</span>
                    </button>
                    <button 
                      onClick={() => handleEdit(selectedRecipe)}
                      className="flex flex-col items-center justify-center p-3 sm:p-4 bg-white border border-zinc-100 rounded-2xl text-zinc-600 hover:bg-zinc-50 transition-all gap-2"
                    >
                      <Edit className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span className="text-[10px] sm:text-xs font-bold">Изменить</span>
                    </button>
                    <button 
                      onClick={() => setIsDeleteConfirmOpen(true)}
                      className="flex flex-col items-center justify-center p-3 sm:p-4 bg-white border border-red-100 rounded-2xl text-red-500 hover:bg-red-50 transition-all gap-2"
                    >
                      <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span className="text-[10px] sm:text-xs font-bold">Удалить</span>
                    </button>
                  </div>

                  {/* Collections Selection UI */}
                  <AnimatePresence>
                    {isCollectionPickerOpen && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-emerald-900">Добавить в сборник</h4>
                            <button 
                              onClick={() => setIsCreatingProgram(true)}
                              className="text-xs font-bold text-emerald-600 flex items-center gap-1 hover:underline"
                            >
                              <Plus className="w-3 h-3" />
                              Создать новый
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {programs.map(program => {
                              const isInProgram = program.recipeIds.includes(selectedRecipe.id);
                              return (
                                <button
                                  key={program.id}
                                  onClick={async () => {
                                    const newRecipeIds = isInProgram 
                                      ? program.recipeIds.filter(id => id !== selectedRecipe.id)
                                      : [...program.recipeIds, selectedRecipe.id];
                                    
                                    try {
                                      await updateDoc(doc(db, "programs", program.id), {
                                        recipeIds: newRecipeIds
                                      });
                                    } catch (err) {
                                      console.error("Error updating program:", err);
                                    }
                                  }}
                                  className={cn(
                                    "flex items-center justify-between p-3 rounded-xl border transition-all text-sm font-medium",
                                    isInProgram ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                  )}
                                >
                                  <span className="truncate">{program.name}</span>
                                  {isInProgram && <Check className="w-4 h-4" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <AnimatePresence>
                    {isPlanning && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 space-y-4">
                          <h4 className="font-bold text-emerald-900">Добавить в план питания</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-emerald-700 uppercase">День</label>
                              <input 
                                type="date"
                                value={planDetails.day}
                                onChange={(e) => setPlanDetails({...planDetails, day: e.target.value})}
                                className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-emerald-700 uppercase">Приём пищи</label>
                              <select 
                                value={planDetails.meal}
                                onChange={(e) => setPlanDetails({...planDetails, meal: e.target.value})}
                                className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                              >
                                <option>Завтрак</option>
                                <option>Обед</option>
                                <option>Ужин</option>
                                <option>Перекус</option>
                              </select>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleAddToPlanner(planDetails.day, planDetails.meal, selectedRecipe.id)}
                            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                          >
                            Подтвердить
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {/* Left Column: Ingredients & Macros */}
                    <div className="md:col-span-1 space-y-10">
                      <div>
                        <h4 className="font-bold text-lg mb-6 flex items-center gap-2">
                          <ChefHat className="w-5 h-5 text-emerald-600" />
                          Ингредиенты
                        </h4>
                        <ul className="space-y-3">
                          {selectedRecipe.ingredients.map((ing, i) => (
                            <li key={i} className="flex items-start gap-3 text-zinc-600 text-sm leading-relaxed">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                              {ing}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-4">КБЖУ (на порцию)</p>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                          <div>
                            <p className="text-xs text-emerald-800/60 mb-0.5">Калории</p>
                            <p className="font-bold text-lg text-emerald-900">{selectedRecipe.macros.calories} ккал</p>
                          </div>
                          <div>
                            <p className="text-xs text-emerald-800/60 mb-0.5">Белки</p>
                            <p className="font-bold text-lg text-emerald-900">{selectedRecipe.macros.proteins}г</p>
                          </div>
                          <div>
                            <p className="text-xs text-emerald-800/60 mb-0.5">Жиры</p>
                            <p className="font-bold text-lg text-emerald-900">{selectedRecipe.macros.fats}г</p>
                          </div>
                          <div>
                            <p className="text-xs text-emerald-800/60 mb-0.5">Углеводы</p>
                            <p className="font-bold text-lg text-emerald-900">{selectedRecipe.macros.carbs}г</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Steps & Others */}
                    <div className="md:col-span-2 space-y-10">
                      <div>
                        <h4 className="font-bold text-lg mb-6 flex items-center gap-2">
                          <Edit3 className="w-5 h-5 text-emerald-600" />
                          Пошаговое приготовление
                        </h4>
                        <div className="space-y-8">
                          {selectedRecipe.steps.map((step, i) => (
                            <div key={i} className="flex gap-5">
                              <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center font-bold text-zinc-500 flex-shrink-0 text-sm">
                                {i + 1}
                              </div>
                              <p className="text-zinc-600 leading-relaxed pt-2">{step}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Время приготовления</p>
                          <div className="flex items-center gap-2 text-zinc-700 font-bold">
                            <Calendar className="w-4 h-4 text-emerald-500" />
                            {selectedRecipe.time}
                          </div>
                        </div>
                        <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Масштабирование порций</p>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRecipe({
                                  ...selectedRecipe,
                                  servings: Math.max(1, selectedRecipe.servings - 1)
                                });
                              }}
                              className="w-8 h-8 flex items-center justify-center bg-white border border-zinc-200 rounded-lg text-zinc-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                            >
                              -
                            </button>
                            <p className="font-bold text-zinc-700 min-w-[20px] text-center">{selectedRecipe.servings}</p>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRecipe({
                                  ...selectedRecipe,
                                  servings: selectedRecipe.servings + 1
                                });
                              }}
                              className="w-8 h-8 flex items-center justify-center bg-white border border-zinc-200 rounded-lg text-zinc-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      {selectedRecipe.substitutions && (
                        <div className="p-8 bg-zinc-50 rounded-3xl border border-zinc-100">
                          <h4 className="font-bold mb-3 text-zinc-800 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-500" />
                            Замена ингредиентов и советы
                          </h4>
                          <p className="text-zinc-600 text-sm leading-relaxed">{selectedRecipe.substitutions}</p>
                        </div>
                      )}

                      <div className="pt-6 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                            <Users className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase">Автор / Создатель</p>
                            <p className="font-bold text-zinc-700">{selectedRecipe.author || 'Не указан'}</p>
                          </div>
                        </div>
                        {selectedRecipe.sourceUrl && (
                          <a 
                            href={selectedRecipe.sourceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-5 py-2.5 rounded-xl font-bold transition-all text-sm"
                          >
                            <LinkIcon className="w-4 h-4" />
                            <span>Источник рецепта</span>
                          </a>
                        )}
                      </div>
                      <div className="pt-10 flex justify-center">
                        <button 
                          onClick={() => {
                            setSelectedRecipe(null);
                            setIsPlanning(false);
                          }}
                          className="w-full sm:w-auto px-12 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-2"
                        >
                          <Check className="w-5 h-5" />
                          Готово
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Navigation - Always at the bottom */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-zinc-200 px-4 py-3 z-50">
        <div className="max-w-lg mx-auto flex justify-between items-center">
          <NavItem 
            active={activeTab === 'recipes'} 
            onClick={() => setActiveTab('recipes')} 
            icon={<BookOpen className="w-6 h-6" />} 
            label="Рецепты" 
          />
          <NavItem 
            active={activeTab === 'planner'} 
            onClick={() => setActiveTab('planner')} 
            icon={<Calendar className="w-6 h-6" />} 
            label="Планер" 
          />
          <NavItem 
            active={activeTab === 'cart'} 
            onClick={() => setActiveTab('cart')} 
            icon={<ShoppingCart className="w-6 h-6" />} 
            label="Корзина" 
          />
          <NavItem 
            active={activeTab === 'tracker'} 
            onClick={() => setActiveTab('tracker')} 
            icon={<Activity className="w-6 h-6" />} 
            label="Трекер" 
          />
          <NavItem 
            active={activeTab === 'programs'} 
            onClick={() => setActiveTab('programs')} 
            icon={<Users className="w-6 h-6" />} 
            label="Программы" 
          />
        </div>
      </nav>

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

                        setActiveNutritionPlan({
                          ...customPlanForm,
                          isCustom: true,
                          programId: docRef.id,
                          allowedProducts: [],
                          forbiddenProducts: []
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
    setActiveNutritionPlan(null);
    localStorage.removeItem('activeNutritionPlan');
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
                          setActiveNutritionPlan(plan);
                          localStorage.setItem('activeNutritionPlan', JSON.stringify(plan));
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
                                setActiveNutritionPlan(plan);
                                localStorage.setItem('activeNutritionPlan', JSON.stringify(plan));
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
    </div>
  );
}

function SidebarItem({ active, onClick, icon, label, count }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, count?: number }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200",
        active 
          ? "bg-emerald-50 text-emerald-700 font-bold" 
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
      )}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      {count !== undefined && (
        <span className={cn(
          "text-[10px] px-1.5 py-0.5 rounded-md font-bold",
          active ? "bg-emerald-200 text-emerald-800" : "bg-zinc-200 text-zinc-500"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all duration-200 min-w-[64px]",
        active 
          ? "text-emerald-600" 
          : "text-zinc-400 hover:text-zinc-600"
      )}
    >
      <div className={cn(
        "p-1 rounded-lg transition-colors",
        active ? "bg-emerald-50" : "bg-transparent"
      )}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center justify-between p-4 bg-white border border-zinc-200 rounded-2xl hover:border-emerald-500 hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-zinc-50 rounded-lg group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
          {icon}
        </div>
        <span className="font-medium text-zinc-700 group-hover:text-zinc-900">{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-emerald-500 transition-colors" />
    </button>
  );
}

function PlaceholderContent({ title, icon }: { title: string, icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-zinc-400">
      <div className="mb-4 opacity-20">
        {icon}
      </div>
      <h2 className="text-xl font-medium">{title}</h2>
      <p className="text-sm mt-2">Этот раздел находится в разработке</p>
    </div>
  );
}
