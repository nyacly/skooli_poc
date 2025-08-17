-- Insert sample categories
INSERT OR IGNORE INTO categories (name, slug, description, icon, sort_order) VALUES 
  ('Stationery', 'stationery', 'Writing materials and office supplies', 'fa-pencil', 1),
  ('Books', 'books', 'Textbooks and reading materials', 'fa-book', 2),
  ('Uniforms', 'uniforms', 'School uniforms and accessories', 'fa-tshirt', 3),
  ('Electronics', 'electronics', 'Electronic devices and accessories', 'fa-laptop', 4),
  ('Sports', 'sports', 'Sports equipment and gear', 'fa-football', 5),
  ('Personal Care', 'personal-care', 'Hygiene and personal care items', 'fa-soap', 6),
  ('Bedding', 'bedding', 'Bedsheets, blankets, and pillows', 'fa-bed', 7),
  ('Food & Snacks', 'food-snacks', 'Non-perishable food items', 'fa-cookie', 8);

-- Insert sample schools
INSERT OR IGNORE INTO schools (name, code, type, address, city, district, region, contact_phone, contact_email) VALUES 
  ('Kings College Budo', 'KCB001', 'secondary', 'P.O. Box 1, Budo', 'Kampala', 'Wakiso', 'Central', '+256700123456', 'info@kingsbudo.ac.ug'),
  ('Gayaza High School', 'GHS001', 'secondary', 'P.O. Box 67, Gayaza', 'Gayaza', 'Wakiso', 'Central', '+256700234567', 'info@gayaza.sc.ug'),
  ('Namugongo SS', 'NSS001', 'secondary', 'P.O. Box 123, Namugongo', 'Namugongo', 'Wakiso', 'Central', '+256700345678', 'info@namugongo.ac.ug');

-- Insert sample products based on typical school requirements
INSERT OR IGNORE INTO products (sku, name, description, category_id, price, stock_quantity, unit, brand, is_active) VALUES 
  -- Stationery
  ('PEN001', 'Bic Blue Pen', 'Pack of 10 blue ballpoint pens', 1, 5000, 500, 'pack', 'Bic', 1),
  ('PEN002', 'Bic Black Pen', 'Pack of 10 black ballpoint pens', 1, 5000, 500, 'pack', 'Bic', 1),
  ('PEN003', 'HB Pencils', 'Pack of 12 HB pencils', 1, 3000, 400, 'pack', 'Staedtler', 1),
  ('BOOK001', '96 Page Exercise Book', 'Squared/ruled exercise book', 1, 2000, 1000, 'piece', 'Picfare', 1),
  ('BOOK002', '48 Page Exercise Book', 'Squared/ruled exercise book', 1, 1500, 1000, 'piece', 'Picfare', 1),
  ('RUL001', '30cm Ruler', 'Transparent plastic ruler', 1, 2000, 300, 'piece', 'Generic', 1),
  ('CALC001', 'Scientific Calculator', 'Casio FX-991ES Plus', 1, 45000, 100, 'piece', 'Casio', 1),
  
  -- Books
  ('TXT001', 'Mathematics Form 1', 'Secondary mathematics textbook', 2, 25000, 200, 'piece', 'MK Publishers', 1),
  ('TXT002', 'English Form 1', 'Secondary English textbook', 2, 22000, 200, 'piece', 'Longhorn', 1),
  ('TXT003', 'Physics Form 1', 'Secondary physics textbook', 2, 28000, 150, 'piece', 'MK Publishers', 1),
  ('DIC001', 'Oxford Dictionary', 'Oxford Advanced Learners Dictionary', 2, 65000, 100, 'piece', 'Oxford', 1),
  
  -- Uniforms
  ('UNI001', 'White Shirt', 'School white shirt (various sizes)', 3, 25000, 300, 'piece', 'Generic', 1),
  ('UNI002', 'Grey Trousers', 'School grey trousers (various sizes)', 3, 35000, 300, 'piece', 'Generic', 1),
  ('UNI003', 'School Sweater', 'Navy blue school sweater', 3, 45000, 200, 'piece', 'Generic', 1),
  ('UNI004', 'Black Shoes', 'Black leather school shoes', 3, 55000, 250, 'pair', 'Bata', 1),
  
  -- Personal Care
  ('SOAP001', 'Bar Soap', 'Pack of 3 bar soaps', 6, 10000, 500, 'pack', 'Geisha', 1),
  ('SOAP002', 'Toothpaste', 'Colgate 100ml toothpaste', 6, 8000, 400, 'piece', 'Colgate', 1),
  ('SOAP003', 'Toilet Paper', 'Pack of 10 rolls', 6, 15000, 300, 'pack', 'Generic', 1),
  ('SOAP004', 'Washing Powder', '1kg washing powder', 6, 12000, 350, 'piece', 'Omo', 1),
  
  -- Bedding
  ('BED001', 'Bed Sheets', 'Set of 2 bed sheets', 7, 35000, 200, 'set', 'Generic', 1),
  ('BED002', 'Blanket', 'Warm fleece blanket', 7, 45000, 150, 'piece', 'Generic', 1),
  ('BED003', 'Pillow', 'Standard size pillow', 7, 20000, 200, 'piece', 'Generic', 1),
  ('BED004', 'Mosquito Net', 'Treated mosquito net', 7, 25000, 180, 'piece', 'Generic', 1),
  
  -- Electronics
  ('ELEC001', 'Phone Charger', 'Universal phone charger', 4, 15000, 100, 'piece', 'Generic', 1),
  ('ELEC002', 'Earphones', 'Standard earphones', 4, 10000, 150, 'piece', 'Generic', 1),
  ('ELEC003', 'Reading Lamp', 'Rechargeable reading lamp', 4, 35000, 80, 'piece', 'Generic', 1);

-- Insert sample school list
INSERT OR IGNORE INTO school_lists (school_id, name, term, year, class, list_type, items) VALUES 
  (1, 'Form 1 Requirements - Term 1', 'Term 1', 2025, 'Form 1', 'requirements', 
   '[{"name":"96 Page Exercise Books","quantity":20,"category":"stationery"},
     {"name":"48 Page Exercise Books","quantity":10,"category":"stationery"},
     {"name":"Blue Pens","quantity":2,"unit":"packs","category":"stationery"},
     {"name":"Black Pens","quantity":1,"unit":"pack","category":"stationery"},
     {"name":"HB Pencils","quantity":1,"unit":"pack","category":"stationery"},
     {"name":"Scientific Calculator","quantity":1,"category":"stationery"},
     {"name":"Mathematics Form 1","quantity":1,"category":"books"},
     {"name":"English Form 1","quantity":1,"category":"books"},
     {"name":"Bar Soap","quantity":3,"unit":"packs","category":"personal-care"},
     {"name":"Bed Sheets","quantity":2,"unit":"sets","category":"bedding"},
     {"name":"Blanket","quantity":1,"category":"bedding"}]');

-- Insert sample admin user
INSERT OR IGNORE INTO users (email, phone, password_hash, first_name, last_name, user_type, is_active, is_verified) VALUES 
  ('admin@skooli.ug', '+256700000000', '$2a$10$YV5QPZV6kJXqGBqLwJ1Zhu8MzUQa6H0qKqX5qK5qK5qK5qK5qK5qK', 'Admin', 'User', 'admin', 1, 1),
  ('parent@example.com', '+256701234567', '$2a$10$YV5QPZV6kJXqGBqLwJ1Zhu8MzUQa6H0qKqX5qK5qK5qK5qK5qK5qK', 'John', 'Doe', 'parent', 1, 1);

-- Insert sample student
INSERT OR IGNORE INTO students (user_id, parent_id, school_id, student_number, class, dormitory, gender) VALUES 
  (2, 2, 1, 'KCB2025001', 'Form 1A', 'Mutesa House', 'male');