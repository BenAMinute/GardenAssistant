# Mobile Revamp TODO - Small Chunks

**Status:** `BLOCKED` - App.tsx compilation errors must be fixed first

---

## 🟥 Phase 1: Fix Compilation (Required Before Any Mobile Work)

### 1.1 Fix JSX Tag Structure
- [ ] Read App.tsx lines 594-692
- [ ] Add missing `</div>` to close the max-width container (line 597's child)
- [ ] Correct closing tag order: `</main>` → `</div> container` → `</div>` outer
- [ ] Verify no duplicate exports in function definition

### 1.2 Build Verification
- [ ] Run `npm run build` 
- [ ] Confirm TypeScript compilation succeeds
- [ ] Check dist/ folder for build artifacts

### 1.3 Push to Firebase
- [ ] Commit fix to GitHub
- [ ] Deploy with `firebase deploy --only hosting`
- [ ] Verify live site loads on `https://gardenassistant-7720c.web.app`

---

## 🟧 Phase 2: Mobile Layout & Responsiveness

### 2.1 Container Width Testing
- [ ] Test at 320px (iPhone SE portrait)
- [ ] Test at 375px (standard iPhone)  
- [ ] Test at 414px (iPhone Plus/XR)
- [ ] Verify no horizontal scroll on any device

### 2.2 Header & Navigation
- [ ] Confirm bottom nav works in portrait
- [ ] Check tab switching flows work on mobile
- [ ] Verify ChevronDown button disappears on desktop screens

### 2.3 Viewport Detection
- [ ] Add meta viewport test to confirm `width=device-width, initial-scale=1.0`
- [ ] Check apple-mobile-web-app-capable tag renders correctly
- [ ] Test Safari's PWA install prompt

---

## 🟦 Phase 3: Touch Targets (44x44px minimum)

### 3.1 Audit Interactive Elements
- [ ] YardOverview buttons: Create/Delete/Duplicate bed elements
- [ ] BedEditor: Resize handles, dropdowns, plant selection
- [ ] PlantGuidePage: Plant card taps, search input
- [ ] Header: Layout picker, Sign in/out buttons

### 3.2 Increase Touch Targets Where Needed
- [ ] Add padding to any element <44px tall/wide
- [ ] Ensure icon-only buttons have aria-labels
- [ ] Test tapping with thumb on actual mobile device

---

## 🟩 Phase 4: PWA Manifest (Optional Enhancements)

### 4.1 Create manifest.json
- [ ] Create `public/manifest.json` 
- [ ] Set name, short_name, start_url
- [ ] Add icons: 192x192, 512x512 PNG files
- [ ] Set theme_color and background_color

### 4.2 Index.html Updates  
- [ ] Add apple-touch-icon favicon reference
- [ ] Configure display-mode for iOS/Android

---

## 🟨 Phase 5: Performance & Optimization

### 5.1 Data Loading
- [ ] Lazy-load PlantGuidePage component
- [ ] Defer plants.ts loading until tab switch
- [ ] Consider pagination for large plant lists

---

## Testing Checklist

- [ ] iOS Safari (iPhone SE → Pro Max)
- [ ] Android Chrome (Pixel phones)
- [ ] Landscape mode on larger devices
- [ ] All major features work: create bed, edit, place plants, guide

---

**Next:** Complete Phase 1 first, then proceed phase-by-phase. Each task should take 5-15 minutes max.
