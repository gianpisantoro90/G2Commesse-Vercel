import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DEFAULT_TAGS, DEFAULT_CATEGORIES, COLOR_PALETTE, EMOJI_ICONS } from "@/lib/tags-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Edit2, Tag, Folder } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TagFormData {
  name: string;
  color: string;
  icon: string;
  description: string;
}

interface CategoryFormData {
  name: string;
  color: string;
  icon: string;
  description: string;
}

function TagForm({ onSubmit, initialData }: {
  onSubmit: (data: TagFormData) => void;
  initialData?: Partial<TagFormData>;
}) {
  const [formData, setFormData] = useState<TagFormData>({
    name: initialData?.name || '',
    color: initialData?.color || '#3B82F6',
    icon: initialData?.icon || '🏷️',
    description: initialData?.description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tag-name">Nome Tag *</Label>
        <Input
          id="tag-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="es. Urgente"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Colore *</Label>
        <div className="grid grid-cols-6 gap-2">
          {COLOR_PALETTE.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => setFormData({ ...formData, color: color.value })}
              className={`w-10 h-10 rounded-lg transition-transform ${
                formData.color === color.value ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : ''
              }`}
              style={{ backgroundColor: color.value }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Icona *</Label>
        <ScrollArea className="h-24 w-full border rounded-md p-2">
          <div className="grid grid-cols-8 gap-2">
            {EMOJI_ICONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setFormData({ ...formData, icon: emoji })}
                className={`text-2xl hover:bg-gray-100 rounded p-1 transition-colors ${
                  formData.icon === emoji ? 'bg-primary/10 ring-2 ring-primary' : ''
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tag-description">Descrizione</Label>
        <Textarea
          id="tag-description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descrizione breve del tag..."
          rows={2}
        />
      </div>

      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
        <span className="text-sm text-gray-600">Anteprima:</span>
        <Badge
          className="text-sm"
          style={{
            backgroundColor: formData.color,
            color: '#ffffff',
            border: 'none'
          }}
        >
          {formData.icon} {formData.name || 'Tag'}
        </Badge>
      </div>

      <DialogFooter>
        <Button type="submit" className="w-full">
          {initialData ? 'Aggiorna Tag' : 'Crea Tag'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CategoryForm({ onSubmit, initialData }: {
  onSubmit: (data: CategoryFormData) => void;
  initialData?: Partial<CategoryFormData>;
}) {
  const [formData, setFormData] = useState<CategoryFormData>({
    name: initialData?.name || '',
    color: initialData?.color || '#10B981',
    icon: initialData?.icon || '📁',
    description: initialData?.description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="category-name">Nome Categoria *</Label>
        <Input
          id="category-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="es. Edilizia"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Colore *</Label>
        <div className="grid grid-cols-6 gap-2">
          {COLOR_PALETTE.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => setFormData({ ...formData, color: color.value })}
              className={`w-10 h-10 rounded-lg transition-transform ${
                formData.color === color.value ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : ''
              }`}
              style={{ backgroundColor: color.value }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Icona *</Label>
        <ScrollArea className="h-24 w-full border rounded-md p-2">
          <div className="grid grid-cols-8 gap-2">
            {EMOJI_ICONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setFormData({ ...formData, icon: emoji })}
                className={`text-2xl hover:bg-gray-100 rounded p-1 transition-colors ${
                  formData.icon === emoji ? 'bg-primary/10 ring-2 ring-primary' : ''
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category-description">Descrizione</Label>
        <Textarea
          id="category-description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descrizione della categoria..."
          rows={2}
        />
      </div>

      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
        <span className="text-sm text-gray-600">Anteprima:</span>
        <Badge
          className="text-sm"
          style={{
            backgroundColor: formData.color,
            color: '#ffffff',
            border: 'none'
          }}
        >
          {formData.icon} {formData.name || 'Categoria'}
        </Badge>
      </div>

      <DialogFooter>
        <Button type="submit" className="w-full">
          {initialData ? 'Aggiorna Categoria' : 'Crea Categoria'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function TagsManager() {
  const { toast } = useToast();
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);

  const handleCreateTag = (data: TagFormData) => {
    console.log('Create tag:', data);
    toast({
      title: "Tag creato",
      description: `Il tag "${data.name}" è stato creato con successo`,
    });
    setIsTagDialogOpen(false);
  };

  const handleCreateCategory = (data: CategoryFormData) => {
    console.log('Create category:', data);
    toast({
      title: "Categoria creata",
      description: `La categoria "${data.name}" è stata creata con successo`,
    });
    setIsCategoryDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tags e Categorie</h2>
        <p className="text-sm text-gray-500">
          Organizza le tue commesse con tags personalizzabili e categorie tematiche
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tags Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Tags
                </CardTitle>
                <CardDescription className="mt-1">
                  Etichette multiple per ogni commessa
                </CardDescription>
              </div>
              <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nuovo Tag
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Crea Nuovo Tag</DialogTitle>
                    <DialogDescription>
                      Crea un tag personalizzato per organizzare le commesse
                    </DialogDescription>
                  </DialogHeader>
                  <TagForm onSubmit={handleCreateTag} />
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Tags Predefiniti</h4>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_TAGS.map((tag) => (
                  <Badge
                    key={tag.name}
                    className="px-3 py-1 text-sm"
                    style={{
                      backgroundColor: tag.color,
                      color: '#ffffff',
                      border: 'none'
                    }}
                    title={tag.description}
                  >
                    {tag.icon} {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Categories Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Folder className="h-5 w-5" />
                  Categorie
                </CardTitle>
                <CardDescription className="mt-1">
                  Una categoria per commessa
                </CardDescription>
              </div>
              <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nuova Categoria
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Crea Nuova Categoria</DialogTitle>
                    <DialogDescription>
                      Crea una categoria tematica per classificare le commesse
                    </DialogDescription>
                  </DialogHeader>
                  <CategoryForm onSubmit={handleCreateCategory} />
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Categorie Predefinite</h4>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_CATEGORIES.map((category) => (
                  <Badge
                    key={category.name}
                    className="px-3 py-1 text-sm"
                    style={{
                      backgroundColor: category.color,
                      color: '#ffffff',
                      border: 'none'
                    }}
                    title={category.description}
                  >
                    {category.icon} {category.name}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-xl">💡</span>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-1">Come funzionano Tags e Categorie?</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li><strong>Tags:</strong> Puoi assegnare più tags ad ogni commessa (es. "Urgente", "VIP", "In Attesa")</li>
                <li><strong>Categorie:</strong> Ogni commessa può avere una sola categoria tematica (es. "Edilizia", "Infrastrutture")</li>
                <li>Usa tags e categorie per filtrare e organizzare rapidamente le tue commesse</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
