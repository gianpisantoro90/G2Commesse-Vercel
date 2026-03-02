import type { Express } from "express";
import { storage } from "../storage";

export function registerProjectFinancialRoutes(app: Express): void {
  // ============================================
  // PROJECT RESOURCES API
  // ============================================

  // Get all project resources
  app.get("/api/project-resources", async (req, res) => {
    const resources = await storage.getAllProjectResources();
    res.json(resources);
  });

  // Create new project resource
  app.post("/api/project-resources", async (req, res) => {
    try {
      const resource = await storage.createProjectResource(req.body);
      res.json(resource);
    } catch (error) {
      console.error('Error creating project resource:', error);
      res.status(500).json({ message: "Errore nella creazione della risorsa" });
    }
  });

  // Update project resource
  app.put("/api/project-resources/:id", async (req, res) => {
    try {
      const resource = await storage.updateProjectResource(req.params.id, req.body);
      res.json(resource);
    } catch (error) {
      console.error('Error updating project resource:', error);
      res.status(500).json({ message: "Errore nell'aggiornamento della risorsa" });
    }
  });

  // Delete project resource
  app.delete("/api/project-resources/:id", async (req, res) => {
    try {
      await storage.deleteProjectResource(req.params.id);
      res.json({ message: "Risorsa eliminata con successo" });
    } catch (error) {
      console.error('Error deleting project resource:', error);
      res.status(500).json({ message: "Errore nell'eliminazione della risorsa" });
    }
  });

  // ============================================
  // PROJECT BUDGETS API
  // ============================================

  // Get all project budgets
  app.get("/api/project-budgets", async (req, res) => {
    const budgets = await storage.getAllProjectBudgets();
    res.json(budgets);
  });

  // Create or update project budget (upsert)
  app.post("/api/project-budgets", async (req, res) => {
    try {
      const budget = await storage.upsertProjectBudget(req.body);
      res.json(budget);
    } catch (error) {
      console.error('Error creating/updating project budget:', error);
      res.status(500).json({ message: "Errore nel salvataggio del budget" });
    }
  });

  // Update project budget
  app.put("/api/project-budgets/:id", async (req, res) => {
    try {
      const budget = await storage.updateProjectBudget(req.params.id, req.body);
      res.json(budget);
    } catch (error) {
      console.error('Error updating project budget:', error);
      res.status(500).json({ message: "Errore nell'aggiornamento del budget" });
    }
  });

  // ============================================
  // PROJECT COSTS API (costi generici)
  // ============================================

  // Get all project costs
  app.get("/api/project-costs", async (req, res) => {
    const costs = await storage.getAllProjectCosts();
    res.json(costs);
  });

  // Create new project cost
  app.post("/api/project-costs", async (req, res) => {
    try {
      const cost = await storage.createProjectCost(req.body);
      res.json(cost);
    } catch (error) {
      console.error('Error creating project cost:', error);
      res.status(500).json({ message: "Errore nella creazione del costo" });
    }
  });

  // Update project cost
  app.put("/api/project-costs/:id", async (req, res) => {
    try {
      const cost = await storage.updateProjectCost(req.params.id, req.body);
      res.json(cost);
    } catch (error) {
      console.error('Error updating project cost:', error);
      res.status(500).json({ message: "Errore nell'aggiornamento del costo" });
    }
  });

  // Delete project cost
  app.delete("/api/project-costs/:id", async (req, res) => {
    try {
      await storage.deleteProjectCost(req.params.id);
      res.json({ message: "Costo eliminato con successo" });
    } catch (error) {
      console.error('Error deleting project cost:', error);
      res.status(500).json({ message: "Errore nell'eliminazione del costo" });
    }
  });
}
