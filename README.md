# Volveme — Sistema interno

App web para gestionar el negocio de Volveme. Arranca con el módulo de Eventos.

## Stack
- React + Vite + Tailwind
- Supabase (base de datos + login del equipo)
- Deploy: Vercel (recomendado, gratis para este uso)

## Cómo correrlo en tu máquina

1. Instalá dependencias:
   ```
   npm install
   ```
2. Copiá `.env.example` a `.env` y completá con tus credenciales de Supabase
   (Project Settings → API Keys en el dashboard de Supabase):
   ```
   cp .env.example .env
   ```
3. Corré el servidor local:
   ```
   npm run dev
   ```
   Se abre en http://localhost:5173

## Cómo subirlo a producción (Vercel)

1. Creá un repo nuevo en GitHub y subí esta carpeta entera.
2. Entrá a vercel.com, "Add New Project", conectá ese repo.
3. En "Environment Variables" cargá las mismas dos variables del `.env`
   (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`).
4. Deploy. Cada push a `main` va a redesplegar solo.

## Estructura

```
src/
  lib/
    supabase.js     → cliente de Supabase
    useAuth.js       → hook de sesión/login
  components/
    Layout.jsx       → navegación superior
    ComingSoon.jsx    → placeholder de módulos no construidos
  pages/
    Login.jsx
    Dashboard.jsx     → pantalla de inicio con accesos a cada módulo
    Eventos.jsx       → lista + carga de eventos
```

## Próximos módulos (en este orden)
Cotizaciones → Staff/Equipamiento → Insumos y Stock → Compras → Facturación y Pagos
