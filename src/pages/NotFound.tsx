import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { useLanguage } from "@/contexts/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    logger.warn("[404] User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">
          {t.notFoundMessage || 'Oops! Page not found'}
        </p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          {t.returnToHome || 'Return to Home'}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
