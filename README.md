# Bento 🍱 - Nutrition & Macro Tracker

A high-performance, mobile-first nutrition and adaptive macro tracking progressive web application built with **React 19**, **Vite**, **Tailwind CSS**, and **Capacitor Android**.

---

## ✨ Features

- **🌸 Electric Rose Aesthetic**: Modern Bento-grid UI with hot pink accents and high-contrast liquid styling.
- **⚡ Adaptive Energy Engine**: Dynamic BMR and TDEE calculations based on biometrics, weekly activity levels, and body weight progression.
- **📊 Real-time Macro Ring Gauge**: Instant feedback on calories, protein, carbohydrates, and fats.
- **🔥 Consecutive Activity Streak**: Dynamic tracking of consecutive logging days.
- **👤 Profile & Identity Customization**: Custom display names and avatar photo uploads with local persistence.
- **🤖 AI Meal Analysis**: Integrated image & natural language meal description breakdown with mathematical energy balance reconciliation.
- **💾 Complete Data Management**: 1-click JSON backup export and restore for all entries, weights, water logs, and foods.
- **📱 Android & Mobile Ready**: Responsive 20:9 mobile proportions (optimized for devices like the Nothing CMF Phone 1) and Capacitor Android build support.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm

### Installation

```bash
# Clone repository
git clone https://github.com/<your-username>/bento.git
cd bento

# Install dependencies
npm install

# Start local development server
npm run dev
```

Open `http://localhost:5173/` in your browser.

---

## 🏗️ Production Build

```bash
# Compile and optimize for production
npm run build

# Preview production build locally
npm run preview
```

---

## 📱 Android App (Capacitor)

```bash
# Sync web build to Android assets
npx cap sync android

# Build debug APK using Gradle
cd android
./gradlew assembleDebug
```
The generated APK will be in `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 🛠️ Tech Stack

- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4 & custom glassmorphism CSS
- **Charts & Visuals**: Recharts & Lucide React
- **Mobile Container**: Capacitor Android

---

## 📄 License

MIT License.
