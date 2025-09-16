import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await apiRequest("GET", "/api/auth/status");
      const result = await response.json();
      setIsAuthenticated(result.authenticated || false);
    } catch (error) {
      console.error("Auth check failed:", error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = () => {
    setIsAuthenticated(true);
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Logout error:", error);
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return {
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuth
  };
}