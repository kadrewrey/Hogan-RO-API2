// scripts/setup-permissions.ts
// Permission setup script for role-based access control

import 'dotenv/config';
import sql, { withCreateAudit } from '../lib/db';

// Enhanced permission definitions with categories
const permissionCategories = {
  users: {
    name: 'User Management',
    permissions: [
      { name: "users:read", description: "View users and user profiles", action: "read" },
      { name: "users:write", description: "Create and update user accounts", action: "write" },
      { name: "users:delete", description: "Delete or deactivate users", action: "delete" },
      { name: "users:impersonate", description: "Login as another user", action: "impersonate" },
      { name: "users:roles", description: "Assign roles to users", action: "roles" },
    ]
  },
  roles: {
    name: 'Role Management',
    permissions: [
      { name: "roles:read", description: "View roles and permissions", action: "read" },
      { name: "roles:write", description: "Create and update roles", action: "write" },
      { name: "roles:delete", description: "Delete roles", action: "delete" },
      { name: "roles:assign", description: "Assign permissions to roles", action: "assign" },
    ]
  },
  pos: {
    name: 'Purchase Orders',
    permissions: [
      { name: "pos:read", description: "View purchase orders", action: "read" },
      { name: "pos:write", description: "Create and update purchase orders", action: "write" },
      { name: "pos:delete", description: "Delete purchase orders", action: "delete" },
      { name: "pos:submit", description: "Submit purchase orders for approval", action: "submit" },
      { name: "pos:approve", description: "Approve purchase orders", action: "approve" },
      { name: "pos:reject", description: "Reject purchase orders", action: "reject" },
      { name: "pos:cancel", description: "Cancel purchase orders", action: "cancel" },
      { name: "pos:match", description: "Match invoices to purchase orders", action: "match" },
    ]
  },
  suppliers: {
    name: 'Supplier Management',
    permissions: [
      { name: "suppliers:read", description: "View supplier information", action: "read" },
      { name: "suppliers:write", description: "Create and update suppliers", action: "write" },
      { name: "suppliers:delete", description: "Delete or deactivate suppliers", action: "delete" },
    ]
  },
  deliveries: {
    name: 'Delivery Management',
    permissions: [
      { name: "deliveries:read", description: "View delivery records", action: "read" },
      { name: "deliveries:write", description: "Create and update deliveries", action: "write" },
      { name: "deliveries:delete", description: "Delete delivery records", action: "delete" },
      { name: "deliveries:receive", description: "Mark items as received", action: "receive" },
    ]
  },
  invoices: {
    name: 'Invoice Management',
    permissions: [
      { name: "invoices:read", description: "View invoices", action: "read" },
      { name: "invoices:write", description: "Create and update invoices", action: "write" },
      { name: "invoices:delete", description: "Delete invoices", action: "delete" },
      { name: "invoices:approve", description: "Approve invoices for payment", action: "approve" },
      { name: "invoices:pay", description: "Mark invoices as paid", action: "pay" },
    ]
  },
  divisions: {
    name: 'Division Management',
    permissions: [
      { name: "divisions:read", description: "View organizational divisions", action: "read" },
      { name: "divisions:write", description: "Create and update divisions", action: "write" },
      { name: "divisions:delete", description: "Delete divisions", action: "delete" },
    ]
  },
  delivery_addresses: {
    name: 'Delivery Addresses',
    permissions: [
      { name: "delivery_addresses:read", description: "View delivery addresses", action: "read" },
      { name: "delivery_addresses:write", description: "Create and update delivery addresses", action: "write" },
      { name: "delivery_addresses:delete", description: "Delete delivery addresses", action: "delete" },
    ]
  },
  files: {
    name: 'File Management',
    permissions: [
      { name: "files:upload", description: "Upload files and attachments", action: "upload" },
      { name: "files:download", description: "Download files and attachments", action: "download" },
      { name: "files:delete", description: "Delete files and attachments", action: "delete" },
      { name: "files:manage", description: "Manage file storage and organization", action: "manage" },
    ]
  },
  admin: {
    name: 'Administration',
    permissions: [
      { name: "admin:overview", description: "View system overview and dashboard", action: "overview" },
      { name: "admin:audit", description: "View audit logs and system activity", action: "audit" },
      { name: "admin:export", description: "Export system data", action: "export" },
      { name: "admin:config", description: "Modify system configuration", action: "config" },
      { name: "admin:maintenance", description: "Perform system maintenance", action: "maintenance" },
    ]
  },
  reports: {
    name: 'Reporting',
    permissions: [
      { name: "reports:view", description: "View standard reports", action: "view" },
      { name: "reports:create", description: "Create custom reports", action: "create" },
      { name: "reports:export", description: "Export reports in various formats", action: "export" },
      { name: "reports:schedule", description: "Schedule automated reports", action: "schedule" },
    ]
  }
};

// Role definitions with detailed permission assignments
const roleDefinitions = [
  {
    name: 'Super Admin',
    description: 'Full system access with all permissions',
    is_system_role: true,
    color: '#dc2626', // Red
    permissions: Object.values(permissionCategories)
      .flatMap(category => category.permissions.map(p => p.name))
  },
  {
    name: 'Admin',
    description: 'Administrative access to most system functions',
    is_system_role: true,
    color: '#ea580c', // Orange
    permissions: [
      // User management (limited)
      'users:read', 'users:write', 'users:roles',
      // Role management
      'roles:read', 'roles:write', 'roles:assign',
      // Full PO access
      ...permissionCategories.pos.permissions.map(p => p.name),
      // Full supplier access
      ...permissionCategories.suppliers.permissions.map(p => p.name),
      // Full delivery access
      ...permissionCategories.deliveries.permissions.map(p => p.name),
      // Full invoice access
      ...permissionCategories.invoices.permissions.map(p => p.name),
      // Division read/write
      'divisions:read', 'divisions:write',
      // Full delivery address access
      ...permissionCategories.delivery_addresses.permissions.map(p => p.name),
      // File management
      ...permissionCategories.files.permissions.map(p => p.name),
      // Admin functions (limited)
      'admin:overview', 'admin:audit', 'admin:export',
      // Reporting
      ...permissionCategories.reports.permissions.map(p => p.name),
    ]
  },
  {
    name: 'Manager',
    description: 'Management level access for department operations',
    is_system_role: true,
    color: '#2563eb', // Blue
    permissions: [
      // User read access
      'users:read',
      // PO management and approval
      'pos:read', 'pos:write', 'pos:submit', 'pos:approve', 'pos:reject', 'pos:match',
      // Supplier read/write
      'suppliers:read', 'suppliers:write',
      // Delivery management
      'deliveries:read', 'deliveries:write', 'deliveries:receive',
      // Invoice management
      'invoices:read', 'invoices:write', 'invoices:approve',
      // Division read
      'divisions:read',
      // Delivery address management
      'delivery_addresses:read', 'delivery_addresses:write',
      // File access
      'files:upload', 'files:download', 'files:delete',
      // Basic admin
      'admin:overview',
      // Standard reporting
      'reports:view', 'reports:create', 'reports:export',
    ]
  },
  {
    name: 'Senior User',
    description: 'Advanced user with extended permissions',
    is_system_role: true,
    color: '#059669', // Green
    permissions: [
      // Basic user access
      'users:read',
      // Extended PO access
      'pos:read', 'pos:write', 'pos:submit', 'pos:match',
      // Supplier read
      'suppliers:read',
      // Delivery read/write
      'deliveries:read', 'deliveries:write', 'deliveries:receive',
      // Invoice read/write
      'invoices:read', 'invoices:write',
      // Division read
      'divisions:read',
      // Delivery address read/write
      'delivery_addresses:read', 'delivery_addresses:write',
      // File access
      'files:upload', 'files:download',
      // Basic reporting
      'reports:view', 'reports:export',
    ]
  },
  {
    name: 'Basic User',
    description: 'Standard user access for daily operations',
    is_system_role: true,
    color: '#6b7280', // Gray
    permissions: [
      // PO basic access
      'pos:read', 'pos:write', 'pos:submit',
      // Supplier read
      'suppliers:read',
      // Delivery read
      'deliveries:read', 'deliveries:receive',
      // Invoice read
      'invoices:read',
      // Division read
      'divisions:read',
      // Delivery address read
      'delivery_addresses:read',
      // Basic file access
      'files:upload', 'files:download',
      // View reports
      'reports:view',
    ]
  },
  {
    name: 'Read Only',
    description: 'View-only access for auditing and reporting',
    is_system_role: true,
    color: '#64748b', // Slate
    permissions: [
      'users:read',
      'roles:read',
      'pos:read',
      'suppliers:read',
      'deliveries:read',
      'invoices:read',
      'divisions:read',
      'delivery_addresses:read',
      'files:download',
      'admin:overview',
      'reports:view',
    ]
  }
];

async function setupPermissions() {
  console.log('🔐 Setting up permissions and roles...');

  try {
    // Check database connection
    await sql`SELECT 1`;
    console.log('✅ Database connection successful');

    // Create all permissions
    console.log('📝 Creating permissions...');
    let permissionCount = 0;
    
    for (const [resource, category] of Object.entries(permissionCategories)) {
      console.log(`  📂 ${category.name}:`);
      
      for (const permission of category.permissions) {
        const existing = await sql`
          SELECT id FROM permissions WHERE name = ${permission.name}
        `;
        
        if (existing.length === 0) {
          const permissionData = withCreateAudit({
            name: permission.name,
            description: permission.description,
            resource: resource,
            action: permission.action,
          }, 'system');
          
          await sql`
            INSERT INTO permissions (
              id, name, description, resource, action, created_at, updated_at
            ) VALUES (
              ${permissionData.id}, ${permissionData.name}, ${permissionData.description},
              ${permissionData.resource}, ${permissionData.action}, ${permissionData.created_at},
              ${permissionData.updated_at}
            )
          `;
          console.log(`    ✓ ${permission.name}`);
          permissionCount++;
        } else {
          console.log(`    → ${permission.name} (exists)`);
        }
      }
    }

    // Create roles and assign permissions
    console.log('👥 Creating roles...');
    let roleCount = 0;
    
    for (const role of roleDefinitions) {
      const existing = await sql`
        SELECT id FROM roles WHERE name = ${role.name} AND deleted_at IS NULL
      `;
      
      if (existing.length === 0) {
        const roleData = withCreateAudit({
          name: role.name,
          description: role.description,
          is_system_role: role.is_system_role,
        }, 'system');
        
        const [newRole] = await sql`
          INSERT INTO roles (
            id, name, description, is_system_role, created_at, updated_at, created_by, updated_by
          ) VALUES (
            ${roleData.id}, ${roleData.name}, ${roleData.description}, ${roleData.is_system_role},
            ${roleData.created_at}, ${roleData.updated_at}, ${roleData.created_by}, ${roleData.updated_by}
          ) RETURNING id
        `;

        // Assign permissions to role
        let assignedPermissions = 0;
        for (const permissionName of role.permissions) {
          const [permission] = await sql`
            SELECT id FROM permissions WHERE name = ${permissionName}
          `;
          
          if (permission) {
            const rolePermissionData = withCreateAudit({
              role_id: newRole.id,
              permission_id: permission.id,
            }, 'system');
            
            await sql`
              INSERT INTO role_permissions (
                id, role_id, permission_id, created_at, updated_at, created_by, updated_by
              ) VALUES (
                ${rolePermissionData.id}, ${rolePermissionData.role_id}, ${rolePermissionData.permission_id},
                ${rolePermissionData.created_at}, ${rolePermissionData.updated_at},
                ${rolePermissionData.created_by}, ${rolePermissionData.updated_by}
              )
            `;
            assignedPermissions++;
          } else {
            console.log(`    ⚠️  Permission not found: ${permissionName}`);
          }
        }
        
        console.log(`  ✓ ${role.name} (${assignedPermissions}/${role.permissions.length} permissions)`);
        roleCount++;
      } else {
        console.log(`  → ${role.name} (exists)`);
      }
    }

    console.log('✅ Permission setup completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - New permissions created: ${permissionCount}`);
    console.log(`   - New roles created: ${roleCount}`);
    console.log(`   - Total permission categories: ${Object.keys(permissionCategories).length}`);
    console.log(`   - Total permissions defined: ${Object.values(permissionCategories).reduce((sum, cat) => sum + cat.permissions.length, 0)}`);
    console.log(`   - Total roles defined: ${roleDefinitions.length}`);

    // Display role hierarchy
    console.log('\n🏗️  Role Hierarchy (by permission count):');
    const roleStats = await sql`
      SELECT 
        r.name,
        r.description,
        COUNT(rp.permission_id) as permission_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id AND rp.deleted_at IS NULL
      WHERE r.deleted_at IS NULL
      GROUP BY r.id, r.name, r.description
      ORDER BY permission_count DESC
    `;
    
    for (const role of roleStats) {
      console.log(`   ${role.name}: ${role.permission_count} permissions`);
    }

  } catch (error) {
    console.error('❌ Permission setup failed:', error);
    throw error;
  }
}

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupPermissions()
    .then(() => {
      console.log('🎉 Permission setup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Permission setup failed:', error);
      process.exit(1);
    });
}

export default setupPermissions;