import type { Express } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { storage } from "../storage";
import { createUserSchema } from "@shared/schema";
import { requireAuth, requireAdmin } from "./middleware";

export function registerUserRoutes(app: Express): void {
  // Get all users (authenticated users can see list - needed for task assignments)
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove password hashes from response
      const safeUsers = users.map(({ passwordHash, ...user }) => user);
      return res.json(safeUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ message: "Errore nel recupero degli utenti" });
    }
  });

  // Create new user (admin only)
  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      // Validate request data with createUserSchema (includes password validation)
      const userData = createUserSchema.parse(req.body);

      // Check if username or email already exists
      const existingUsers = await storage.getAllUsers();
      if (existingUsers.some(u => u.username === userData.username)) {
        return res.status(400).json({ message: "Username già esistente" });
      }
      if (existingUsers.some(u => u.email === userData.email)) {
        return res.status(400).json({ message: "Email già esistente" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, 10);

      // Create user with hashed password (omit password field, add passwordHash)
      const { password, ...userDataWithoutPassword } = userData;
      const newUser = await storage.createUser({
        ...userDataWithoutPassword,
        passwordHash
      });

      // Remove password hash from response
      const { passwordHash: _, ...safeUser } = newUser;
      return res.status(201).json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dati non validi", errors: error.errors });
      }
      console.error('Error creating user:', error);
      return res.status(500).json({ message: "Errore nella creazione dell'utente" });
    }
  });

  // Update user (admin only)
  app.put("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Don't allow direct password hash updates through this endpoint
      if (updates.passwordHash) {
        delete updates.passwordHash;
      }

      const updatedUser = await storage.updateUser(id, updates);
      if (!updatedUser) {
        return res.status(404).json({ message: "Utente non trovato" });
      }

      // Remove password hash from response
      const { passwordHash: _, ...safeUser } = updatedUser;
      return res.json(safeUser);
    } catch (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({ message: "Errore nell'aggiornamento dell'utente" });
    }
  });

  // Delete user (admin only)
  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      // Prevent deleting own account
      if (id === req.session.userId) {
        return res.status(400).json({ message: "Non puoi eliminare il tuo stesso account" });
      }

      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ message: "Utente non trovato" });
      }

      return res.json({ success: true, message: "Utente eliminato con successo" });
    } catch (error) {
      console.error('Error deleting user:', error);
      return res.status(500).json({ message: "Errore nell'eliminazione dell'utente" });
    }
  });

  // Change password (any authenticated user)
  app.post("/api/users/change-password", async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Password attuale e nuova password sono obbligatorie" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "La nuova password deve essere di almeno 8 caratteri" });
      }

      // Get current user
      const user = await storage.getUserById(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "Utente non trovato" });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "Password attuale non corretta" });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Update password
      await storage.updateUser(user.id, { passwordHash: newPasswordHash });

      return res.json({ success: true, message: "Password aggiornata con successo" });
    } catch (error) {
      console.error('Error changing password:', error);
      return res.status(500).json({ message: "Errore nel cambio password" });
    }
  });
}
