'use client';

import {
  ArrowLeftIcon as ArrowLeft,
  CubeIcon as Boxes,
  ChartLineUpIcon as ChartLineUp,
  KanbanIcon as FolderKanban,
  ShieldCheckIcon as ShieldCheck,
  UsersIcon as Users,
  WrenchIcon as Wrench,
  type Icon as LucideIcon,
} from '@phosphor-icons/react';
import { useTranslations } from '@/i18n/use-translations';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { PROJECT_LANDING_PATH } from '@/lib/onboarding/landing-destination';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function AdminSidebar() {
  const tI18nComplete = useTranslations('hardcodedUi.i18nComplete');
  const pathname = usePathname();

  // Only pages that actually exist under app/admin/*. Operations was removed
  // (the /admin overview already carries the health pills); "Sandboxes" is the
  // renamed providers console — operators manage sandboxes, providers are the
  // implementation detail.
  const primaryItems: NavItem[] = [
    {
      href: '/admin/accounts',
      label: tI18nComplete.raw('text8a7c8b67fe8b'),
      icon: Users,
    },
    {
      href: '/admin/projects',
      label: tI18nComplete.raw('text04e2a9728af7'),
      icon: FolderKanban,
    },
    {
      href: '/admin/analytics',
      label: tI18nComplete.raw('text94c116ee118a'),
      icon: ChartLineUp,
    },
    {
      href: '/admin/sandboxes',
      label: tI18nComplete.raw('text3f2c01e07be5'),
      icon: Boxes,
    },
    {
      href: '/admin/utils',
      label: tI18nComplete.raw('text17ccfa5b681e'),
      icon: Wrench,
    },
  ];

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-sidebar-border/60 border-b">
        <Link
          href="/admin"
          className="hover:text-foreground flex items-center gap-2 px-2 py-1.5 transition-colors"
        >
          <div className="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-2xl">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight">
              {tI18nComplete.raw('textc1c224b03cd9')}
            </span>
            <span className="text-muted-foreground text-xs">
              {tI18nComplete.raw('text4e65e85103ec')}
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryItems.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border/60 border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={tI18nComplete.raw('textd44f5e641157')}>
              <Link href={PROJECT_LANDING_PATH} prefetch>
                <ArrowLeft />
                <span>{tI18nComplete.raw('texta6989680b352')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string | null }) {
  const active = isActive(pathname, item.href);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
        <Link href={item.href}>
          <item.icon />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}
