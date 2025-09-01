#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of training and settings pages that need protection
const pagesToProtect = [
  'src/app/training/projects/create/page.tsx',
  'src/app/training/projects/[id]/page.tsx',
  'src/app/training/projects/[id]/edit/page.tsx',
  'src/app/training/projects/[id]/videos/page.tsx',
  'src/app/training/projects/[id]/videos/upload/page.tsx',
  'src/app/training/projects/[id]/videos/[videoId]/page.tsx',
  'src/app/training/projects/[id]/videos/[videoId]/edit/page.tsx',
  'src/app/settings/fine-tune/page.tsx',
  'src/app/settings/models/page.tsx'
];

const addRoleBasedProtection = (filePath) => {
  console.log(`Processing: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already has RoleBasedRoute
  if (content.includes('RoleBasedRoute')) {
    console.log(`${filePath} already has RoleBasedRoute protection`);
    return;
  }

  // Add RoleBasedRoute import if not present
  if (!content.includes('RoleBasedRoute')) {
    if (content.includes("import ProtectedRoute from '@/components/ProtectedRoute';")) {
      content = content.replace(
        "import ProtectedRoute from '@/components/ProtectedRoute';",
        "import ProtectedRoute from '@/components/ProtectedRoute';\nimport RoleBasedRoute from '@/components/RoleBasedRoute';"
      );
    } else {
      // Add both imports
      const importMatch = content.match(/import.*from.*['"]@\/components\/.*['"];?\n/);
      if (importMatch) {
        const lastImport = importMatch[0];
        content = content.replace(
          lastImport,
          lastImport + "import ProtectedRoute from '@/components/ProtectedRoute';\nimport RoleBasedRoute from '@/components/RoleBasedRoute';\n"
        );
      }
    }
  }

  // Wrap with RoleBasedRoute
  if (content.includes('<ProtectedRoute>')) {
    content = content.replace(
      '<ProtectedRoute>',
      '<ProtectedRoute>\n      <RoleBasedRoute allowedRoles={[\'ADMIN\']}>'
    );
    content = content.replace(
      '</ProtectedRoute>',
      '</RoleBasedRoute>\n    </ProtectedRoute>'
    );
  } else if (content.includes('<AppLayout>')) {
    // If no ProtectedRoute, add both
    content = content.replace(
      '<AppLayout>',
      '<ProtectedRoute>\n      <RoleBasedRoute allowedRoles={[\'ADMIN\']}>\n        <AppLayout>'
    );
    content = content.replace(
      '</AppLayout>',
      '</AppLayout>\n      </RoleBasedRoute>\n    </ProtectedRoute>'
    );
  }

  fs.writeFileSync(filePath, content);
  console.log(`Updated: ${filePath}`);
};

// Process all pages
pagesToProtect.forEach(pagePath => {
  const fullPath = path.join(__dirname, '..', pagePath);
  addRoleBasedProtection(fullPath);
});

console.log('Role-based protection setup complete!');
