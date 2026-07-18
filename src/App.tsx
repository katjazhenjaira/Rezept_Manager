/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { updateDoc, doc, getDoc } from "firebase/firestore";
import { db } from "./infrastructure/firebaseApp";

import { useNutritionPlan, useUserProfile } from '@/app/providers/UserProfileContext';
import { useData } from '@/app/providers/DataContext';
import { TabBar } from '@/app/layout/TabBar';
import { AppHeader } from '@/app/layout/AppHeader';
import { RecipeSelectionBar } from '@/app/layout/RecipeSelectionBar';
import { SettingsModal } from '@/features/settings/SettingsModal';
import { CartView } from '@/features/cart/CartView';
import { ProgramsView } from '@/features/programs/ProgramsView';
import type {
  Tab,
  Recipe,
  UserProfile,
  Program,
} from '@/shared/domain/types';
import { RecipesView } from '@/features/recipes/RecipesView';
import { PlannerView } from '@/features/planner/PlannerView';
import { TrackerView } from '@/features/tracker/TrackerView';

const DEFAULT_PROFILE: UserProfile = {
  name: '', age: 30, gender: 'female',
  currentWeight: 65, targetWeight: 60,
  targetCalories: 1800, targetProteins: 100, targetFats: 60, targetCarbs: 200,
  waterGoal: 2000, allergies: [],
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('recipes');
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


  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecipeSelectionMode, setIsRecipeSelectionMode] = useState(false);
  const [selectionTarget, setSelectionTarget] = useState<{ programId: string, subfolderId: string | 'main' } | null>(null);
  const [recipeTarget, setRecipeTarget] = useState<{ programId: string, subfolderId: string | 'main' } | null>(null);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);
  const [checkedEntries, setCheckedEntries] = useState<string[]>([]);
  const [mealTypes, setMealTypes] = useState(['Завтрак', 'Обед', 'Ужин', 'Перекус']);
  const [openProgramId, setOpenProgramId] = useState<string | null>(null);
  const { activeNutritionPlan } = useNutritionPlan();
  const { userProfile: contextProfile } = useUserProfile();
  const userProfile = contextProfile ?? DEFAULT_PROFILE;
  const { recipes, cartItems, programs } = useData();

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
        return <CartView cart={cartItems} />;
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
            onSelectRecipe={setSelectedRecipe}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">

      <AppHeader onOpenSettings={() => setIsSettingsOpen(true)} />

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

      <RecipeSelectionBar
        isVisible={isRecipeSelectionMode}
        selectedCount={selectedRecipeIds.length}
        onCancel={() => {
          setIsRecipeSelectionMode(false);
          setSelectionTarget(null);
          setSelectedRecipeIds([]);
          if (selectionTarget?.programId) setOpenProgramId(selectionTarget.programId);
        }}
        onConfirm={handleAddSelectedRecipes}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        availableCategories={availableCategories}
        setAvailableCategories={setAvailableCategories}
        onCategoryRemoved={() => {}}
      />
    </div>
  );
}
