# Remove Framer Motion and NextUI

## Context

This project currently includes Framer Motion and NextUI as dependencies, both adding significant bundle weight (~500KB+ combined) and performance overhead. Analysis reveals:

- **Framer Motion (v12.29.2)**: Completely unused - not imported anywhere. All animations use GSAP via custom hooks (`useAnimateText`, `useAnimateContainer`).
- **NextUI (@nextui-org/react v2.6.11)**: Moderately used for layout and UI components across 13+ files.

The goal is to remove both libraries, replace NextUI components with lightweight Tailwind-based alternatives, and maintain all existing functionality, themes, and accessibility features.

## Implementation Strategy

Use a **phased approach** to minimize risk, with testing after each phase:

---

### Phase 1: Remove Framer Motion ✅ (ZERO risk)

Framer Motion is installed but completely unused.

**Files to modify:**
- [package.json](package.json)

**Actions:**
1. Remove `"framer-motion": "^12.29.2"` from dependencies
2. Run `npm install`
3. Verify: `npm run build` succeeds

---

### Phase 2: Replace Button Component

ThemeButton uses NextUI's `extendVariants` API and is used 20+ times throughout the app.

**Critical file:**
- [components/Theme/ThemeButton.js](components/Theme/ThemeButton.js)

**Actions:**
1. Replace NextUI Button with native `<button>` using Tailwind classes
2. Preserve existing API: `onPress`, `isDisabled`, `isLoading`, `color` (primary/secondary/blur), `variant` (full)
3. Implement loading spinner overlay for `isLoading` state
4. Map color variants to Tailwind theme classes (bg-primary, bg-secondary, etc.)

**Key requirements:**
- Backward-compatible API (all existing usages continue working)
- Loading state shows spinner overlay with dimmed button
- Disabled state with proper opacity and cursor
- Hover/active states with Tailwind transitions

**Testing:**
- Verify all forms still work (subscribe, manage, investor flows)
- Test disabled states
- Test loading states
- Verify theme colors across all whitelabels (default, yhs, kw, uco)

---

### Phase 3: Replace Card Components

Card/CardBody are the primary layout components, used in 8 files.

**Create new file:**
- [components/Theme/Card.tsx](components/Theme/Card.tsx) (NEW)

**Actions:**
1. Create `Card` component with support for:
   - `isPressable` prop (cursor-pointer, hover effects, onClick)
   - `onPress` callback
   - Keyboard accessibility (Enter/Space keys, focus states, tabIndex)
2. Create `CardBody` component with default padding
3. Update imports in 8 files from `@nextui-org/react` to `@/components/Theme/Card`

**Files to update:**
- [app/page.tsx](app/page.tsx)
- [app/subscribe/SubscribePageClient.tsx](app/subscribe/SubscribePageClient.tsx)
- [app/manage/ManagePageClient.tsx](app/manage/ManagePageClient.tsx)
- [app/investor/InvestorPageClient.tsx](app/investor/InvestorPageClient.tsx)
- [components/Theme/ProductCard.js](components/Theme/ProductCard.js)
- [components/UI/LandingPage/Pricing.js](components/UI/LandingPage/Pricing.js)
- [components/forms/manage/steps/DashboardStep.tsx](components/forms/manage/steps/DashboardStep.tsx)

**Key requirements:**
- Standard card: white background, rounded-lg, shadow-md
- Pressable cards: cursor-pointer, hover:shadow-lg, scale animation on click
- Full keyboard navigation (Tab, Enter, Space)
- Proper ARIA attributes (role="button" when pressable)

**Testing:**
- Navigate to all pages and verify card layouts
- Test pressable cards in ProductCard and DashboardStep
- Verify keyboard navigation works (Tab to focus, Enter/Space to activate)
- Check visual consistency (spacing, shadows, borders)

---

### Phase 4: Replace Spinner Component

Spinner is used in 4 files for loading states.

**Create new file:**
- [components/Theme/Spinner.tsx](components/Theme/Spinner.tsx) (NEW)

**Actions:**
1. Create spinner using SVG with Tailwind's `animate-spin`
2. Support size variants: sm, md, lg
3. Support color variants: primary, secondary, default
4. Update imports in 4 files

**Files to update:**
- [app/investor/page.tsx](app/investor/page.tsx) - Suspense fallback
- [app/manage/page.tsx](app/manage/page.tsx) - Suspense fallback
- [app/subscribe/page.tsx](app/subscribe/page.tsx) - Suspense fallback
- [components/forms/manage/steps/ManageSubscriptionStep.tsx](components/forms/manage/steps/ManageSubscriptionStep.tsx) - Query loading

**Testing:**
- Navigate to pages and verify Suspense fallbacks show spinner
- Test loading state in ManageSubscriptionStep
- Verify spinner animation is smooth

---

### Phase 5: Replace Modal Component

Modal includes state management, backdrop, focus trap, and accessibility.

**Critical file:**
- [components/Theme/Modal.js](components/Theme/Modal.js)

**Actions:**
1. Replace NextUI modal components with custom implementation
2. Create `useDisclosure` hook (returns `isOpen`, `onOpen`, `onClose`, `onToggle`)
3. Create modal components: `Modal`, `ModalContent`, `ModalHeader`, `ModalBody`, `ModalFooter`
4. Implement:
   - React portal to document.body
   - ESC key closes modal
   - Backdrop click closes modal
   - Focus trap (Tab cycles through focusable elements)
   - Body scroll prevention when open
   - Fade-in/zoom-in animations

**Key requirements:**
- Full keyboard accessibility (ESC, Tab, focus trap)
- Click backdrop to close
- Prevent body scroll when open
- Smooth animations (fade-in + zoom-in)
- Maintain existing API for backward compatibility

**Testing:**
- Verify modal opens/closes
- Test ESC key closes modal
- Test clicking backdrop closes modal
- Verify Tab key cycles focus within modal
- Test body scroll is prevented when open
- Verify animations are smooth

---

### Phase 6: Remove NextUI Provider

NextUIProvider wraps the entire app but only serves NextUI components.

**Critical file:**
- [providers/UIProvider.tsx](providers/UIProvider.tsx)

**Actions:**
1. Remove NextUIProvider import and wrapper
2. Convert UIProvider to simple passthrough: `<>{children}</>`
3. Alternative: Remove UIProvider entirely and update layout.tsx

**File to update:**
- [app/layout.tsx](app/layout.tsx) - If removing UIProvider completely

**Testing:**
- Verify app still renders
- Verify QueryProvider still works

---

### Phase 7: Update Tailwind Configuration

Remove NextUI plugin while preserving the theme system.

**Critical file:**
- [tailwind.config.js](tailwind.config.js)

**Actions:**
1. Remove `import { nextui } from "@nextui-org/react"`
2. Remove `nextui({ ... })` plugin from plugins array
3. Remove `"./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}"` from content array
4. **KEEP** `createThemes` plugin - it provides theme classes (bg-primary, text-secondary, etc.) independent of NextUI
5. Add modal animation keyframes to theme.extend.keyframes:
   - `fade-in`: opacity 0 → 1
   - `zoom-in`: scale 0.95 → 1

**Key requirements:**
- Theme classes continue working (bg-primary, text-secondary, bg-default-100, etc.)
- All whitelabel themes work (default, yhs, kw, uco)

**Testing:**
- Verify theme classes still work: bg-primary, text-secondary
- Test all whitelabel themes: default, yhs, kw, uco
- Verify modal animations play smoothly

---

### Phase 8: Remove NextUI from package.json

Final cleanup.

**Files to modify:**
- [package.json](package.json)

**Actions:**
1. Remove `"@nextui-org/react": "^2.6.11"` from dependencies
2. Run `rm -rf node_modules package-lock.json`
3. Run `npm install`
4. Run `npm run build`
5. Run `npm run dev`

**Testing:**
- Verify build succeeds with no errors
- Verify all pages load correctly
- Run existing tests: `npm test`

---

## Critical Implementation Details

### Button Component API
```typescript
interface ThemeButtonProps {
  color?: "primary" | "secondary" | "blur"
  variant?: "full" // full width
  isDisabled?: boolean
  isLoading?: boolean
  onPress?: () => void
  children: React.ReactNode
  className?: string
}
```

### Card Component API
```typescript
interface CardProps {
  isPressable?: boolean
  onPress?: () => void
  children: React.ReactNode
  className?: string
}
```

### Modal Hook API
```typescript
const { isOpen, onOpen, onClose, onToggle } = useDisclosure()
```

---

## Reusable Patterns

**Reference implementations to follow:**
- Button loading state: SVG spinner overlay (same pattern as existing Spinner component)
- Card pressable behavior: Scale animation on click, hover shadow lift
- Modal animations: Tailwind's animate utilities with custom keyframes
- Theme colors: Use existing tw-colors classes (bg-primary, text-secondary, etc.)

---

## Verification & Testing

### End-to-End Testing Checklist

**All Pages:**
- [ ] Landing page (/) - Card layouts, ProductCard clickable
- [ ] Subscribe flow (/subscribe) - Forms work, loading states, cards
- [ ] Manage page (/manage) - Subscription management, DashboardStep clickable cards
- [ ] Investor page (/investor) - Layout and forms

**All Themes:**
- [ ] Default theme - bg-primary (#4D9CB9), bg-secondary (#EC8B33)
- [ ] YHS theme - bg-primary (#164D86), bg-secondary (#B12029)
- [ ] KW theme - bg-primary (#3C3C3C), bg-secondary (#C50032)
- [ ] UCO theme - bg-primary (#164D86), bg-secondary (#C20F19)

**Component Testing:**
- [ ] ThemeButton: All color variants, loading state, disabled state, click handlers
- [ ] Card: Standard cards, pressable cards, keyboard navigation
- [ ] Spinner: All sizes, all colors, animation smoothness
- [ ] Modal: Open/close, ESC key, backdrop click, focus trap, scroll prevention

**Build & Tests:**
- [ ] `npm run build` succeeds with no errors
- [ ] `npm test` passes all tests
- [ ] No console errors in browser
- [ ] No NextUI imports remain (search codebase: `@nextui-org`)
- [ ] No framer-motion imports remain

**Accessibility:**
- [ ] All interactive elements keyboard accessible (Tab navigation)
- [ ] Focus states visible (focus-visible rings)
- [ ] ARIA attributes present (role, aria-modal, etc.)
- [ ] Screen reader announcements work (modal open/close)

---

## Rollback Plan

**Git Strategy:**
```bash
git checkout -b remove-nextui-framer
# After each phase:
git add .
git commit -m "Phase X: [description]"

# If issues arise:
git revert <commit-hash>  # or git reset --hard <previous-commit>
```

**Per-phase rollback:** Revert individual phase commits via git
**Full rollback:** Reset to branch start point if major issues occur

---

## Success Criteria

1. ✅ No `@nextui-org/react` imports in codebase
2. ✅ No `framer-motion` in package.json
3. ✅ All pages render correctly
4. ✅ All forms function properly
5. ✅ All themes work (default, yhs, kw, uco)
6. ✅ No console errors or warnings
7. ✅ Build succeeds: `npm run build`
8. ✅ Tests pass: `npm test`
9. ✅ Accessibility maintained (keyboard nav, ARIA)
10. ✅ Bundle size reduced (~500KB smaller)

---

## Expected Bundle Impact

- **Framer Motion removal**: ~150KB gzipped
- **NextUI removal**: ~350KB gzipped
- **Total savings**: ~500KB gzipped (~40% reduction for typical Next.js app)
- **Performance**: Faster initial page loads, reduced JavaScript parse time
