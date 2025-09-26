// scripts/seed-database.ts
// Database seeding script for the Hogan RO API

import 'dotenv/config';
import sql, { withCreateAudit } from '../lib/db';
import { hashPassword } from '../lib/auth';

// Sample data
const divisions = [
  { name: 'Engineering' },
  { name: 'Marketing' },
  { name: 'Operations' },
  { name: 'Finance' },
];

const suppliers = [
  {
    name: 'Tech Solutions Inc',
    contact_email: 'contact@techsolutions.com',
    contact_phone: '+1-555-0123',
    address_line_1: '123 Tech Street',
    city: 'San Francisco',
    state: 'CA',
    postal_code: '94102',
    country: 'USA',
    is_active: true,
  },
  {
    name: 'Office Supplies Co',
    contact_email: 'orders@officesupplies.com',
    contact_phone: '+1-555-0456',
    address_line_1: '456 Supply Ave',
    city: 'New York',
    state: 'NY',
    postal_code: '10001',
    country: 'USA',
    is_active: true,
  },
];

const deliveryAddresses = [
  {
    name: 'Main Office',
    address_line_1: '789 Business Blvd',
    address_line_2: 'Suite 100',
    city: 'Chicago',
    state: 'IL',
    postal_code: '60601',
    country: 'USA',
    is_active: true,
  },
  {
    name: 'Warehouse',
    address_line_1: '321 Industrial Way',
    city: 'Phoenix',
    state: 'AZ',
    postal_code: '85001',
    country: 'USA',
    is_active: true,
  },
];

const permissions = [
  // User Management
  { name: "users:read", description: "View users", resource: "users", action: "read" },
  { name: "users:write", description: "Create and update users", resource: "users", action: "write" },
  { name: "users:delete", description: "Delete users", resource: "users", action: "delete" },
  
  // Role Management
  { name: "roles:read", description: "View roles", resource: "roles", action: "read" },
  { name: "roles:write", description: "Create and update roles", resource: "roles", action: "write" },
  { name: "roles:delete", description: "Delete roles", resource: "roles", action: "delete" },
  
  // Purchase Order Management
  { name: "pos:read", description: "View purchase orders", resource: "pos", action: "read" },
  { name: "pos:write", description: "Create and update purchase orders", resource: "pos", action: "write" },
  { name: "pos:delete", description: "Delete purchase orders", resource: "pos", action: "delete" },
  { name: "pos:approve", description: "Approve purchase orders", resource: "pos", action: "approve" },
  { name: "pos:reject", description: "Reject purchase orders", resource: "pos", action: "reject" },
  { name: "pos:submit", description: "Submit purchase orders", resource: "pos", action: "submit" },
  
  // Supplier Management
  { name: "suppliers:read", description: "View suppliers", resource: "suppliers", action: "read" },
  { name: "suppliers:write", description: "Create and update suppliers", resource: "suppliers", action: "write" },
  { name: "suppliers:delete", description: "Delete suppliers", resource: "suppliers", action: "delete" },
  
  // Delivery Management
  { name: "deliveries:read", description: "View deliveries", resource: "deliveries", action: "read" },
  { name: "deliveries:write", description: "Create and update deliveries", resource: "deliveries", action: "write" },
  { name: "deliveries:delete", description: "Delete deliveries", resource: "deliveries", action: "delete" },
  
  // Invoice Management
  { name: "invoices:read", description: "View invoices", resource: "invoices", action: "read" },
  { name: "invoices:write", description: "Create and update invoices", resource: "invoices", action: "write" },
  { name: "invoices:delete", description: "Delete invoices", resource: "invoices", action: "delete" },
  
  // Division Management
  { name: "divisions:read", description: "View divisions", resource: "divisions", action: "read" },
  { name: "divisions:write", description: "Create and update divisions", resource: "divisions", action: "write" },
  { name: "divisions:delete", description: "Delete divisions", resource: "divisions", action: "delete" },
  
  // Delivery Address Management
  { name: "delivery_addresses:read", description: "View delivery addresses", resource: "delivery_addresses", action: "read" },
  { name: "delivery_addresses:write", description: "Create and update delivery addresses", resource: "delivery_addresses", action: "write" },
  { name: "delivery_addresses:delete", description: "Delete delivery addresses", resource: "delivery_addresses", action: "delete" },
  
  // Admin Functions
  { name: "admin:overview", description: "View admin overview", resource: "admin", action: "overview" },
  { name: "admin:audit", description: "View audit logs", resource: "admin", action: "audit" },
  { name: "admin:export", description: "Export data", resource: "admin", action: "export" },
  
  // File Management
  { name: "files:upload", description: "Upload files", resource: "files", action: "upload" },
  { name: "files:download", description: "Download files", resource: "files", action: "download" },
  { name: "files:delete", description: "Delete files", resource: "files", action: "delete" },
];

const roles = [
  {
    name: 'Admin',
    description: 'Full system access',
    is_system_role: true,
    permissions: permissions.map(p => p.name), // All permissions
  },
  {
    name: 'Manager',
    description: 'Management level access',
    is_system_role: true,
    permissions: [
      'users:read', 'users:write',
      'pos:read', 'pos:write', 'pos:approve', 'pos:reject', 'pos:submit',
      'suppliers:read', 'suppliers:write',
      'deliveries:read', 'deliveries:write',
      'invoices:read', 'invoices:write',
      'delivery_addresses:read', 'delivery_addresses:write',
      'files:upload', 'files:download',
    ],
  },
  {
    name: 'Basic User',
    description: 'Basic user access',
    is_system_role: true,
    permissions: [
      'pos:read', 'pos:write', 'pos:submit',
      'suppliers:read',
      'deliveries:read',
      'invoices:read',
      'delivery_addresses:read',
      'files:upload', 'files:download',
    ],
  },
];

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  try {
    // Check database connection
    await sql`SELECT 1`;
    console.log('✅ Database connection successful');

    // Seed divisions
    console.log('📁 Seeding divisions...');
    for (const division of divisions) {
      const existing = await sql`
        SELECT id FROM divisions WHERE name = ${division.name} AND deleted_at IS NULL
      `;
      
      if (existing.length === 0) {
        const divisionData = withCreateAudit(division, 'system');
        await sql`
          INSERT INTO divisions (id, name, created_at, updated_at, created_by, updated_by)
          VALUES (${divisionData.id}, ${divisionData.name}, ${divisionData.created_at}, 
                  ${divisionData.updated_at}, ${divisionData.created_by}, ${divisionData.updated_by})
        `;
        console.log(`  ✓ Created division: ${division.name}`);
      } else {
        console.log(`  → Division already exists: ${division.name}`);
      }
    }

    // Seed suppliers
    console.log('🏢 Seeding suppliers...');
    for (const supplier of suppliers) {
      const existing = await sql`
        SELECT id FROM suppliers WHERE name = ${supplier.name} AND deleted_at IS NULL
      `;
      
      if (existing.length === 0) {
        const supplierData = withCreateAudit(supplier, 'system');
        await sql`
          INSERT INTO suppliers (
            id, name, contact_email, contact_phone, address_line_1, city, state, 
            postal_code, country, is_active, created_at, updated_at, created_by, updated_by
          ) VALUES (
            ${supplierData.id}, ${supplierData.name}, ${supplierData.contact_email}, 
            ${supplierData.contact_phone}, ${supplierData.address_line_1}, ${supplierData.city}, 
            ${supplierData.state}, ${supplierData.postal_code}, ${supplierData.country}, 
            ${supplierData.is_active}, ${supplierData.created_at}, ${supplierData.updated_at}, 
            ${supplierData.created_by}, ${supplierData.updated_by}
          )
        `;
        console.log(`  ✓ Created supplier: ${supplier.name}`);
      } else {
        console.log(`  → Supplier already exists: ${supplier.name}`);
      }
    }

    // Seed delivery addresses
    console.log('📍 Seeding delivery addresses...');
    for (const address of deliveryAddresses) {
      const existing = await sql`
        SELECT id FROM delivery_addresses WHERE name = ${address.name} AND deleted_at IS NULL
      `;
      
      if (existing.length === 0) {
        const addressData = withCreateAudit(address, 'system');
        await sql`
          INSERT INTO delivery_addresses (
            id, name, address_line_1, address_line_2, city, state, postal_code, 
            country, is_active, created_at, updated_at, created_by, updated_by
          ) VALUES (
            ${addressData.id}, ${addressData.name}, ${addressData.address_line_1}, 
            ${addressData.address_line_2}, ${addressData.city}, ${addressData.state}, 
            ${addressData.postal_code}, ${addressData.country}, ${addressData.is_active}, 
            ${addressData.created_at}, ${addressData.updated_at}, ${addressData.created_by}, 
            ${addressData.updated_by}
          )
        `;
        console.log(`  ✓ Created delivery address: ${address.name}`);
      } else {
        console.log(`  → Delivery address already exists: ${address.name}`);
      }
    }

    // Seed permissions
    console.log('🔐 Seeding permissions...');
    for (const permission of permissions) {
      const existing = await sql`
        SELECT id FROM permissions WHERE name = ${permission.name}
      `;
      
      if (existing.length === 0) {
        const permissionData = withCreateAudit(permission, 'system');
        await sql`
          INSERT INTO permissions (
            id, name, description, resource, action, created_at, updated_at
          ) VALUES (
            ${permissionData.id}, ${permissionData.name}, ${permissionData.description}, 
            ${permissionData.resource}, ${permissionData.action}, ${permissionData.created_at}, 
            ${permissionData.updated_at}
          )
        `;
        console.log(`  ✓ Created permission: ${permission.name}`);
      } else {
        console.log(`  → Permission already exists: ${permission.name}`);
      }
    }

    // Seed roles
    console.log('👤 Seeding roles...');
    for (const role of roles) {
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
          }
        }
        
        console.log(`  ✓ Created role: ${role.name} with ${role.permissions.length} permissions`);
      } else {
        console.log(`  → Role already exists: ${role.name}`);
      }
    }

    // Create default admin user
    console.log('👑 Creating default admin user...');
    const adminEmail = 'admin@hoganro.com';
    const existingAdmin = await sql`
      SELECT id FROM users WHERE email = ${adminEmail} AND deleted_at IS NULL
    `;
    
    if (existingAdmin.length === 0) {
      const hashedPassword = await hashPassword('admin123');
      const [engineeringDivision] = await sql`
        SELECT id FROM divisions WHERE name = 'Engineering' AND deleted_at IS NULL LIMIT 1
      `;
      
      const adminData = withCreateAudit({
        email: adminEmail,
        password_hash: hashedPassword,
        name: 'System Administrator',
        role: 'admin',
        division_id: engineeringDivision?.id || null,
        spending_limit_cents: 1000000000, // $10M
        is_active: true,
      }, 'system');
      
      const [newUser] = await sql`
        INSERT INTO users (
          id, email, password_hash, name, role, division_id, spending_limit_cents, 
          is_active, created_at, updated_at, created_by, updated_by
        ) VALUES (
          ${adminData.id}, ${adminData.email}, ${adminData.password_hash}, ${adminData.name}, 
          ${adminData.role}, ${adminData.division_id}, ${adminData.spending_limit_cents}, 
          ${adminData.is_active}, ${adminData.created_at}, ${adminData.updated_at}, 
          ${adminData.created_by}, ${adminData.updated_by}
        ) RETURNING id
      `;

      // Assign admin role to user
      const [adminRole] = await sql`
        SELECT id FROM roles WHERE name = 'Admin' AND deleted_at IS NULL
      `;
      
      if (adminRole) {
        const userRoleData = withCreateAudit({
          user_id: newUser.id,
          role_id: adminRole.id,
        }, 'system');
        
        await sql`
          INSERT INTO user_roles (
            id, user_id, role_id, created_at, updated_at, created_by, updated_by
          ) VALUES (
            ${userRoleData.id}, ${userRoleData.user_id}, ${userRoleData.role_id}, 
            ${userRoleData.created_at}, ${userRoleData.updated_at}, 
            ${userRoleData.created_by}, ${userRoleData.updated_by}
          )
        `;
      }
      
      console.log(`  ✓ Created admin user: ${adminEmail} (password: admin123)`);
    } else {
      console.log(`  → Admin user already exists: ${adminEmail}`);
    }

    console.log('✅ Database seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Divisions: ${divisions.length}`);
    console.log(`   - Suppliers: ${suppliers.length}`);
    console.log(`   - Delivery Addresses: ${deliveryAddresses.length}`);
    console.log(`   - Permissions: ${permissions.length}`);
    console.log(`   - Roles: ${roles.length}`);
    console.log('   - Default admin user created');
    console.log('\n🔐 Default Admin Credentials:');
    console.log('   Email: admin@hoganro.com');
    console.log('   Password: admin123');

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log('🎉 Seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}

export default seedDatabase;