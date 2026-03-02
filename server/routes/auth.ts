import type { Express } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../storage";
import { loginLimiter } from "./middleware";

export function registerAuthRoutes(app: Express): void {
  // Security: Apply rate limiting to login endpoint
  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    try {
      // Trim whitespace from username and password
      const username = req.body.username?.trim();
      const password = req.body.password?.trim();

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: "Username e password sono obbligatori"
        });
      }

      // Try to authenticate against database first
      const user = await storage.getUserByUsername(username);

      if (user && user.active) {
        // Verify password
        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (isValid) {
          // Security: Regenerate session ID to prevent session fixation attacks
          req.session.regenerate((err) => {
            if (err) {
              console.error('Session regeneration error:', err);
              return res.status(500).json({
                success: false,
                message: "Errore durante la sessione"
              });
            }

            // Set authenticated flag and user data after regeneration
            req.session.authenticated = true;
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.fullName = user.fullName;
            req.session.role = user.role as 'admin' | 'user';

            return res.json({
              success: true,
              message: "Login effettuato con successo",
              user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                role: user.role
              }
            });
          });
          return;
        }
      }

      // Invalid credentials
      return res.status(401).json({
        success: false,
        message: "Credenziali non valide"
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        success: false,
        message: "Errore interno del server"
      });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.authenticated = false;
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({
          success: false,
          message: "Errore durante il logout"
        });
      }
      return res.json({
        success: true,
        message: "Logout effettuato con successo"
      });
    });
  });

  app.get("/api/auth/status", (req, res) => {
    return res.json({
      authenticated: !!req.session.authenticated,
      user: req.session.authenticated ? {
        id: req.session.userId,
        username: req.session.username,
        fullName: req.session.fullName,
        role: req.session.role
      } : null
    });
  });
}
