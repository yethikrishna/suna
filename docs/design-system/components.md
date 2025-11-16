Y0 Design System Components

Buttons
- Primary: use `variant="default"` on `Button`
- Secondary: `variant="secondary"`
- Outline: `variant="outline"`
- Ghost: `variant="ghost"`
- Sizes: `size="sm|default|lg|icon"`

Forms
- Inputs: background `bg-input`, border `border-border`
- Focus: `focus-visible:ring-ring/50 focus-visible:ring-[3px]`
- Errors: `aria-invalid` applies destructive ring/border

Cards & Surfaces
- Use `bg-card` and `text-card-foreground`
- Apply `shadow-sm` by default, `shadow-md` on hover where interactive

Navigation
- Container: `bg-background/75 border-border backdrop-blur`
- Active link: `text-primary font-medium`

Typography
- Headlines: `.font-display`
- Body: `font-sans`
- Code: `font-mono`

Spacing & Radius
- Spacing: 4px base unit; Tailwind scales
- Radius: `--radius` propagated to `rounded-*` utilities

Responsive Layout
- Grid with `max-w-7xl` container and `px-4 md:px-6`
- Use `md:` and `lg:` breakpoints for navigation and forms

Implementation Example
```tsx
import { Button } from '@/components/ui/button';

export function CTA() {
  return (
    <div className="rounded-2xl bg-background/60 border border-border p-6">
      <h2 className="font-display text-2xl">Start with Y0</h2>
      <p className="mt-2 text-sm text-muted-foreground">Unified, modern platform experience.</p>
      <div className="mt-4 flex gap-3">
        <Button variant="default" size="lg">Get Started</Button>
        <Button variant="outline" size="lg">Learn More</Button>
      </div>
    </div>
  );
}
```