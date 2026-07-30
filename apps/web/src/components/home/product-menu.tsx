'use client';

import { marketingButtonVariants } from '@/components/ui/marketing/button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import type { NavMenu } from '@/lib/site-config';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const MENU_VALUE = 'product';

interface ProductMenuProps {
  name: string;
  menu: NavMenu;
  isNavActive: (href: string) => boolean;
}

/**
 * Desktop "Product" mega-menu. Radix NavigationMenu gives hover-open, Escape and
 * focus-outside dismissal for free; the controlled `value` adds open-on-focus so
 * the menu is reachable with Tab alone.
 */
export function ProductMenu({ name, menu, isNavActive }: ProductMenuProps) {
  const [value, setValue] = useState('');
  const isOpenRef = useRef(false);
  const skipFocusOpenRef = useRef(false);
  const hasActiveLink = menu.columns.some((column) =>
    column.links.some((link) => isNavActive(link.href)),
  );

  // Escape closes the menu and returns focus to the trigger. Without this guard
  // the trigger's onFocus re-opens the menu the user just dismissed. Radix binds
  // its own Escape handler on `document` in the capture phase when the content
  // mounts; this listener is registered earlier, so it always runs first.
  useEffect(() => {
    const handleEscapeCapture = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !isOpenRef.current) return;
      skipFocusOpenRef.current = true;
      window.setTimeout(() => {
        skipFocusOpenRef.current = false;
      }, 0);
    };
    document.addEventListener('keydown', handleEscapeCapture, { capture: true });
    return () => document.removeEventListener('keydown', handleEscapeCapture, { capture: true });
  }, []);

  const handleValueChange = (next: string) => {
    isOpenRef.current = next === MENU_VALUE;
    setValue(next);
  };

  const handleTriggerFocus = () => {
    if (skipFocusOpenRef.current) return;
    handleValueChange(MENU_VALUE);
  };

  return (
    <NavigationMenu
      value={value}
      onValueChange={handleValueChange}
      viewport={false}
      className="max-w-none flex-none"
    >
      <NavigationMenuList>
        <NavigationMenuItem value={MENU_VALUE}>
          <NavigationMenuTrigger
            onFocus={handleTriggerFocus}
            className={cn(
              marketingButtonVariants({ variant: 'ghost', size: 'sm' }),
              'font-medium',
              hasActiveLink
                ? 'text-foreground'
                : 'text-foreground/90 hover:text-foreground data-[state=open]:text-foreground',
            )}
          >
            {name}
          </NavigationMenuTrigger>
          <NavigationMenuContent className="[&>div]:bg-transparent [&>div]:p-0">
            <div className="w-[38rem] max-w-[calc(100vw-2.5rem)]">
              <div className="grid grid-cols-2 gap-x-4 p-2">
                {menu.columns.map((column) => (
                  <div key={column.title} className="flex flex-col">
                    <p className="text-muted-foreground px-2 pt-1.5 pb-2 text-[11px] font-medium tracking-wider uppercase">
                      {column.title}
                    </p>
                    {column.links.map((link) => (
                      <NavigationMenuLink
                        key={link.href}
                        asChild
                        active={isNavActive(link.href)}
                      >
                        <Link href={link.href} className="gap-0.5 rounded-sm px-2 py-1.5">
                          <span className="text-foreground text-sm leading-tight font-medium">
                            {link.name}
                          </span>
                          {link.description && (
                            <span className="text-muted-foreground text-xs leading-snug">
                              {link.description}
                            </span>
                          )}
                        </Link>
                      </NavigationMenuLink>
                    ))}
                  </div>
                ))}
              </div>
              <div className="border-border flex items-center justify-between gap-4 border-t px-4 py-2.5">
                <p className="text-muted-foreground text-xs">{menu.footer.text}</p>
                <NavigationMenuLink asChild>
                  <Link
                    href={menu.footer.href}
                    className="text-foreground shrink-0 flex-row rounded-sm px-2 py-1 text-xs font-medium"
                  >
                    {menu.footer.linkLabel}
                  </Link>
                </NavigationMenuLink>
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
