# Vento & Pistón Academy

Plataforma interna de capacitación técnica, fichas de producto, pólizas de garantía, guía de tiempos CESVE y gamificación conectada a **Google Sheets + Google Apps Script**.

## Estructura del Proyecto

- `apps-script/Code.gs`: Backend REST API para Google Apps Script.
- `src/services/sheetsApi.ts`: Cliente HTTP para comunicación con Google Sheets.
- `src/data/seedData.ts`: Catálogo base inicial para poblar las hojas.
- `src/components/`: Vistas de Catálogo, Garantías/Tiempos, Quiz, Moto Runner y Panel Admin.

## Configuración Rápida

1. Copia `.env.example` a `.env` y coloca tu URL de implementación de Google Apps Script en `VITE_SHEETS_API_URL`.
2. Instala dependencias:
   ```bash
   npm install
   ```
3. Inicia en desarrollo:
   ```bash
   npm run dev
   ```
4. Compila para producción (GitHub Pages / Vercel / Netlify):
   ```bash
   npm run build
   ```
