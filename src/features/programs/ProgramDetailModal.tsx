import React, { useState } from 'react';
import {
  ChevronLeft, Plus, Edit2, Edit3, Trash2, FolderPlus,
  BookOpen, Camera, FileText, Link as LinkIcon, Activity,
  ChevronDown, Upload, ShoppingCart,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { Program, Recipe, Resource } from '@/shared/domain/types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function AddRecipeOption({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
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

export type ProgramDetailModalProps = {
  program: Program;
  recipes: Recipe[];
  availableCategories: string[];
  programRecipeFilter: string;
  onProgramRecipeFilterChange: (f: string) => void;
  onClose: () => void;
  onDeleteProgram: (program: Program) => void;
  onStartRecipeSelection: (programId: string, subfolderId: string | 'main') => void;
  onRecipeTargetSet: (target: { programId: string; subfolderId: string | 'main' }) => void;
  recipeTarget: { programId: string; subfolderId: string | 'main' } | null;
  onRecipeTargetCleared: () => void;
  photoInputRef: React.RefObject<HTMLInputElement>;
  isAddingManual: boolean; onIsAddingManualChange: (v: boolean) => void;
  isAddingLink: boolean;   onIsAddingLinkChange: (v: boolean) => void;
  isAddingPDF: boolean;    onIsAddingPDFChange: (v: boolean) => void;
  isScanning: boolean;     onIsScanningChange: (v: boolean) => void;
  onAddProductsToCart: (products: string[]) => void;
};

export function ProgramDetailModal(props: ProgramDetailModalProps) {
  const {
    program, recipes, availableCategories, programRecipeFilter,
    onProgramRecipeFilterChange, onClose, onDeleteProgram,
    onStartRecipeSelection, onRecipeTargetSet, photoInputRef,
    isAddingManual, onIsAddingManualChange,
    isAddingLink, onIsAddingLinkChange,
    isAddingPDF, onIsAddingPDFChange,
    onAddProductsToCart,
  } = props;

  const [openSubfolderId, setOpenSubfolderId] = useState<string | null>(null);
  const [editingSubfolderId, setEditingSubfolderId] = useState<string | null>(null);
  const [editingEntity, setEditingEntity] = useState<{
    type: 'program' | 'subfolder';
    id: string;
    programId?: string;
  } | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '', description: '',
    targetCalories: 0, targetProteins: 0, targetFats: 0, targetCarbs: 0,
    resources: [] as Resource[],
    allowedProducts: [] as string[],
    forbiddenProducts: [] as string[],
  });
  const [programAddRecipeDropdown, setProgramAddRecipeDropdown] = useState<{
    programId: string;
    subfolderId: string | 'main';
  } | null>(null);
  const [subfolderToDelete, setSubfolderToDelete] = useState<{
    programId: string;
    subfolderId: string;
    name: string;
  } | null>(null);
  const [showProducts, setShowProducts] = useState(false);
  const [activeResourceForm, setActiveResourceForm] = useState<{
    targetId: string;
    type: 'link' | 'pdf';
  } | null>(null);
  const [resourceFormData, setResourceFormData] = useState({
    url: '', title: '', description: '',
  });
  const subfolderPdfInputRef = React.useRef<HTMLInputElement>(null);

  // placeholder — full JSX added in Task 2
  return null;
}
