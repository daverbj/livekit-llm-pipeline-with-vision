'use client';

import React, { useState, useEffect } from 'react';
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
  Monitor,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Shield,
  Users as UsersIcon,
} from 'lucide-react';
import QuantiVisionLogo from './QuantiVisionLogo';

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
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    children: [
      {
        id: 'system',
        label: 'System Status',
        icon: Monitor,
        href: '/settings/system',
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

  // Don't render sidebar for end users (role USER)
  if (user?.role === 'USER') {
    return null;
  }

  // Combine regular menu items with admin items if user is admin (but not super admin)
  const allMenuItems = React.useMemo(() => {
    const items = [...menuItems];
    if (user?.role === 'ADMIN') {
      items.push(...adminMenuItems);
    }
    return items;
  }, [user]);

  // Auto-expand parent menus when their children are active
  React.useEffect(() => {
    const activeParents: string[] = [];
    
    allMenuItems.forEach(item => {
      if (item.children) {
        const hasActiveChild = item.children.some(child => 
          child.href && pathname === child.href
        );
        if (hasActiveChild) {
          activeParents.push(item.id);
        }
      }
    });

    if (activeParents.length > 0) {
      setExpandedItems(prev => {
        const newExpanded = [...new Set([...prev, ...activeParents])];
        return newExpanded;
      });
    }
  }, [pathname]);

  const toggleExpanded = (itemId: string) => {
    // Only allow toggling when sidebar is not collapsed
    if (isCollapsed) return;
    
    setExpandedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  // Prevent any clicks within the sidebar from propagating up
  const handleSidebarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isCollapsed) {
                toggleExpanded(item.id);
              }
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              isChildActive
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-700 hover:bg-gray-100'
            } ${level > 0 ? 'ml-4' : ''}`}
          >
            <div className="flex items-center">
              <item.icon className="w-5 h-5 mr-3" />
              {!isCollapsed && (
                <span>{item.label}</span>
              )}
            </div>
            {!isCollapsed && (
              <div className="transition-transform duration-200">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </div>
            )}
          </button>
          {!isCollapsed && isExpanded && item.children && (
            <div 
              className="mt-1 space-y-1 pl-2"
              onClick={(e) => e.stopPropagation()}
            >
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
        className={`block px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
          isItemActive
            ? 'bg-indigo-100 text-indigo-700'
            : 'text-gray-700 hover:bg-gray-100'
        } ${level > 0 ? 'ml-6' : ''}`}
        onClick={(e) => {
          // Ensure the sidebar doesn't collapse when clicking submenu items
          e.stopPropagation();
        }}
      >
        <div className="flex items-center">
          <item.icon className="w-5 h-5 mr-3" />
          {!isCollapsed && <span>{item.label}</span>}
        </div>
      </Link>
    );
  };

  return (
    <div
      className={`bg-white border-r border-gray-200 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
      onClick={handleSidebarClick}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {!isCollapsed ? (
          <div className="flex items-center space-x-3">
            <QuantiVisionLogo size="md" className="text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900">QuantiVision</h2>
          </div>
        ) : (
          <QuantiVisionLogo size="md" className="text-indigo-600" />
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
