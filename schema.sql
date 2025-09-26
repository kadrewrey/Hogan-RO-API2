-- schema.sql
-- Database schema for Hogan RO API v2

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Divisions table
CREATE TABLE IF NOT EXISTS divisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sub VARCHAR(255), -- JWT subject (for external auth systems)
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'basic' CHECK (role IN ('basic', 'manager', 'admin')),
    division_id UUID REFERENCES divisions(id),
    spending_limit_cents BIGINT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Role permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id),
    permission_id UUID NOT NULL REFERENCES permissions(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(role_id, permission_id)
);

-- User roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, role_id)
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address_line_1 VARCHAR(255),
    address_line_2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Delivery addresses table
CREATE TABLE IF NOT EXISTS delivery_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) DEFAULT 'USA',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Purchase orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    division_id UUID NOT NULL REFERENCES divisions(id),
    supplier_id UUID REFERENCES suppliers(id),
    order_type VARCHAR(20) NOT NULL DEFAULT 'single' CHECK (order_type IN ('single', 'rolling')),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'delivered', 'invoiced', 'exceptions')),
    total_value_cents BIGINT DEFAULT 0,
    delivery_address_id UUID REFERENCES delivery_addresses(id),
    order_end_date DATE,
    tags JSONB,
    attachments JSONB,
    comments TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    submitted_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Purchase order lines table
CREATE TABLE IF NOT EXISTS po_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id),
    line_no INTEGER NOT NULL,
    sku VARCHAR(255),
    description TEXT,
    qty DECIMAL(12,2) NOT NULL,
    unit_price_cents BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(po_id, line_no)
);

-- Deliveries table
CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id),
    delivered_at TIMESTAMP WITH TIME ZONE NOT NULL,
    pod_file_url VARCHAR(500), -- Proof of delivery file URL
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Delivery lines table
CREATE TABLE IF NOT EXISTS delivery_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL REFERENCES deliveries(id),
    po_line_id UUID NOT NULL REFERENCES po_lines(id),
    qty_received DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id),
    supplier_invoice_no VARCHAR(255) NOT NULL,
    invoice_date DATE NOT NULL,
    invoice_file_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Invoice lines table
CREATE TABLE IF NOT EXISTS invoice_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    po_line_id UUID NOT NULL REFERENCES po_lines(id),
    qty_invoiced DECIMAL(12,2) NOT NULL,
    unit_price_cents BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Exports table (for tracking data exports)
CREATE TABLE IF NOT EXISTS exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_id UUID REFERENCES purchase_orders(id),
    format VARCHAR(10) NOT NULL CHECK (format IN ('csv', 'json', 'pdf')),
    file_url VARCHAR(500),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    generated_by UUID NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    user_id UUID,
    po_id UUID, -- For PO-related actions
    at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_division ON users(division_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_division ON purchase_orders(division_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_by ON purchase_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON purchase_orders(created_at);

CREATE INDEX IF NOT EXISTS idx_po_lines_po_id ON po_lines(po_id);
CREATE INDEX IF NOT EXISTS idx_po_lines_sku ON po_lines(sku);

CREATE INDEX IF NOT EXISTS idx_deliveries_po_id ON deliveries(po_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivered_at ON deliveries(delivered_at);

CREATE INDEX IF NOT EXISTS idx_invoices_po_id ON invoices(po_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_invoice_no ON invoices(supplier_invoice_no);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_addresses_active ON delivery_addresses(is_active) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_po_id ON audit_log(po_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_at ON audit_log(at);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create updated_at triggers for all tables
CREATE TRIGGER update_divisions_updated_at BEFORE UPDATE ON divisions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_role_permissions_updated_at BEFORE UPDATE ON role_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON user_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_delivery_addresses_updated_at BEFORE UPDATE ON delivery_addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_po_lines_updated_at BEFORE UPDATE ON po_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_delivery_lines_updated_at BEFORE UPDATE ON delivery_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoice_lines_updated_at BEFORE UPDATE ON invoice_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();