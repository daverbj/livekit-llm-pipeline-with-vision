'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  Home,
  GraduationCap,
  FolderOpen,
  Settings,
  Cpu,
  Zap,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Shield,
  Users as UsersIcon,
} from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  href?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    href: '/',
  },
  {
    id: 'training',
    label: 'Training',
    icon: GraduationCap,
    children: [
      {
        id: 'projects',
        label: 'Projects',
        icon: FolderOpen,
        href: '/training/projects',
      },
      {
        id: 'integration',
        label: 'Integration',
        icon: Cpu,
        href: '/training/integration',
      },
    ],
  },
];

// Admin menu items (will be added conditionally)
const adminMenuItems: MenuItem[] = [
  {
    id: 'admin',
    label: 'Admin',
    icon: Shield,
    children: [
      {
        id: 'admin-dashboard',
        label: 'Dashboard',
        icon: Home,
        href: '/admin',
      },
      {
        id: 'admin-users',
        label: 'User Management',
        icon: UsersIcon,
        href: '/admin/users',
      },
    ],
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const pathname = usePathname();
  const { user } = useAuth();

  // Combine regular menu items with admin items if user is admin
  const allMenuItems = React.useMemo(() => {
    const items = [...menuItems];
    if (user?.role === 'ADMIN') {
      items.push(...adminMenuItems);
    }
    return items;
  }, [user]);

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const isActive = (href: string) => {
    return pathname === href;
  };

  const isParentActive = (children: MenuItem[]) => {
    return children.some(child => child.href && isActive(child.href));
  };

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.id);
    const isItemActive = item.href ? isActive(item.href) : false;
    const isChildActive = hasChildren ? isParentActive(item.children!) : false;

    if (hasChildren) {
      return (
        <div key={item.id}>
          <button
            onClick={() => toggleExpanded(item.id)}
            className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              isChildActive
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-700 hover:bg-gray-100'
            } ${level > 0 ? 'ml-4' : ''}`}
          >
            <div className="flex items-center">
              <item.icon className="w-5 h-5 mr-3" />
              {!isCollapsed && (
                <>
                  <span>{item.label}</span>
                </>
              )}
            </div>
            {!isCollapsed && (
              <>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </>
            )}
          </button>
          {!isCollapsed && isExpanded && item.children && (
            <div className="mt-1 space-y-1">
              {item.children.map(child => renderMenuItem(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.id}
        href={item.href!}
        className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
          isItemActive
            ? 'bg-indigo-100 text-indigo-700'
            : 'text-gray-700 hover:bg-gray-100'
        } ${level > 0 ? 'ml-8' : ''}`}
      >
        <item.icon className="w-5 h-5 mr-3" />
        {!isCollapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  return (
    <div
      className={`bg-white border-r border-gray-200 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {!isCollapsed && (
          <h2 className="text-lg font-semibold text-gray-800">Navigation</h2>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {isCollapsed ? (
            <Menu className="w-5 h-5 text-gray-600" />
          ) : (
            <X className="w-5 h-5 text-gray-600" />
          )}
        </button>
      </div>

      <nav className="p-4 space-y-2">
        {allMenuItems.map(item => renderMenuItem(item))}
      </nav>
    </div>
  );
}
