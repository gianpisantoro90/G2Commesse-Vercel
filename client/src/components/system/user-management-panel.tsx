import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'admin' | 'user';
  active: boolean;
  createdAt: string;
}

export default function UserManagementPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    fullName: '',
    password: '',
    role: 'user' as 'admin' | 'user',
    active: true,
  });

  const [editFormData, setEditFormData] = useState({
    username: '',
    email: '',
    fullName: '',
    role: 'user' as 'admin' | 'user',
    active: true,
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await apiRequest("GET", "/api/users");
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare gli utenti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username || !formData.email || !formData.fullName || !formData.password) {
      toast({
        title: "Errore",
        description: "Tutti i campi sono obbligatori",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        title: "Errore",
        description: "La password deve essere di almeno 8 caratteri",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiRequest("POST", "/api/users", formData);
      toast({
        title: "Successo",
        description: "Utente creato con successo",
      });
      setShowCreateForm(false);
      setFormData({
        username: '',
        email: '',
        fullName: '',
        password: '',
        role: 'user',
        active: true,
      });
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile creare l'utente",
        variant: "destructive",
      });
    }
  };

  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    try {
      await apiRequest("PUT", `/api/users/${userId}`, updates);
      toast({
        title: "Successo",
        description: "Utente aggiornato con successo",
      });
      setEditingUser(null);
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile aggiornare l'utente",
        variant: "destructive",
      });
    }
  };

  const handleOpenEditDialog = (user: User) => {
    setEditingUser(user);
    setEditFormData({
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      active: user.active,
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingUser) return;

    if (!editFormData.username || !editFormData.email || !editFormData.fullName) {
      toast({
        title: "Errore",
        description: "Tutti i campi sono obbligatori",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiRequest("PUT", `/api/users/${editingUser.id}`, editFormData);
      toast({
        title: "Successo",
        description: "Utente modificato con successo",
      });
      setShowEditDialog(false);
      setEditingUser(null);
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile modificare l'utente",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Sei sicuro di voler eliminare l'utente "${username}"?`)) {
      return;
    }

    try {
      await apiRequest("DELETE", `/api/users/${userId}`);
      toast({
        title: "Successo",
        description: "Utente eliminato con successo",
      });
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile eliminare l'utente",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (user: User) => {
    await handleUpdateUser(user.id, { active: !user.active });
  };

  if (loading) {
    return <div className="p-4 text-center">Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Gestione Utenti
        </h2>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-secondary hover:bg-secondary/90"
        >
          {showCreateForm ? "Annulla" : "+ Nuovo Utente"}
        </Button>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateUser} className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Crea Nuovo Utente
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="mario.rossi"
                required
              />
            </div>

            <div>
              <Label htmlFor="fullName">Nome Completo *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Mario Rossi"
                required
              />
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="mario.rossi@example.com"
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Min. 8 caratteri"
                required
                minLength={8}
              />
            </div>

            <div>
              <Label htmlFor="role">Ruolo *</Label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              >
                <option value="user">Utilizzatore</option>
                <option value="admin">Amministratore</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="active"
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="active">Utente attivo</Label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="bg-primary hover:bg-primary/90">
              Crea Utente
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateForm(false)}
            >
              Annulla
            </Button>
          </div>
        </form>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Utente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ruolo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Creato il
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                        {user.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {user.fullName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          @{user.username}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.role === 'admin'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    }`}>
                      {user.role === 'admin' ? 'Amministratore' : 'Utilizzatore'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(user)}
                      disabled={user.id === currentUser?.id}
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      } ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                    >
                      {user.active ? 'Attivo' : 'Disattivato'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString('it-IT')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    {user.id !== currentUser?.id ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditDialog(user)}
                          className="text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900"
                        >
                          ✏️ Modifica
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id, user.username)}
                        >
                          🗑️ Elimina
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditDialog(user)}
                        className="text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900"
                      >
                        ✏️ Modifica Profilo
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {users.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Nessun utente trovato
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingUser?.id === currentUser?.id ? 'Modifica Profilo' : 'Modifica Utente'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-username">Username *</Label>
                <Input
                  id="edit-username"
                  value={editFormData.username}
                  onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                  placeholder="mario.rossi"
                  required
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <Label htmlFor="edit-fullName">Nome Completo *</Label>
                <Input
                  id="edit-fullName"
                  value={editFormData.fullName}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                  placeholder="Mario Rossi"
                  required
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  placeholder="mario.rossi@example.com"
                  required
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <Label htmlFor="edit-role">Ruolo *</Label>
                <Select
                  value={editFormData.role}
                  onValueChange={(value) => setEditFormData({ ...editFormData, role: value as 'admin' | 'user' })}
                  disabled={editingUser?.id === currentUser?.id}
                >
                  <SelectTrigger id="edit-role" className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectItem value="user" className="text-gray-900 dark:text-white">Utilizzatore</SelectItem>
                    <SelectItem value="admin" className="text-gray-900 dark:text-white">Amministratore</SelectItem>
                  </SelectContent>
                </Select>
                {editingUser?.id === currentUser?.id && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Non puoi modificare il tuo ruolo
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="edit-active"
                type="checkbox"
                checked={editFormData.active}
                onChange={(e) => setEditFormData({ ...editFormData, active: e.target.checked })}
                className="w-4 h-4"
                disabled={editingUser?.id === currentUser?.id}
              />
              <Label htmlFor="edit-active">Utente attivo</Label>
              {editingUser?.id === currentUser?.id && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  (Non puoi disattivare il tuo account)
                </span>
              )}
            </div>

            {editingUser && (
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-sm">
                <p className="text-gray-600 dark:text-gray-400">
                  <strong>Creato il:</strong> {new Date(editingUser.createdAt).toLocaleDateString('it-IT', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditDialog(false)}
              >
                Annulla
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                Salva Modifiche
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
