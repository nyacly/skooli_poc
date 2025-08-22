#!/usr/bin/env node

// Script to seed Supabase with sample data for Skooli
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ztvouhjrpvmmlinulksu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0dm91aGpycHZtbWxpbnVsa3N1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc0Mzc1MiwiZXhwIjoyMDcxMzE5NzUyfQ.atv0PUfEBZuWjG-b438uR71FPX0oP11Hz1PbCGmg3O4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Sample categories
const categories = [
  {
    name: 'Notebooks & Paper',
    slug: 'notebooks-paper',
    description: 'Exercise books, notebooks, and paper supplies',
    icon: 'book'
  },
  {
    name: 'Writing Materials',
    slug: 'writing-materials', 
    description: 'Pens, pencils, erasers, and markers',
    icon: 'pen'
  },
  {
    name: 'Art Supplies',
    slug: 'art-supplies',
    description: 'Crayons, colored pencils, and art materials',
    icon: 'palette'
  },
  {
    name: 'School Bags',
    slug: 'school-bags',
    description: 'Backpacks and school bags',
    icon: 'shopping-bag'
  },
  {
    name: 'Mathematics',
    slug: 'mathematics',
    description: 'Calculators, rulers, and math tools',
    icon: 'calculator'
  },
  {
    name: 'Science Equipment',
    slug: 'science-equipment',
    description: 'Laboratory and science supplies',
    icon: 'flask'
  }
];

// Sample products
const products = [
  // Notebooks & Paper
  {
    name: 'Exercise Book A4 (96 pages)',
    description: 'High-quality A4 exercise book with 96 pages, perfect for all subjects',
    price: 2500,
    sku: 'EXB-A4-96',
    stock_quantity: 150,
    is_featured: true,
    image_url: '/static/placeholder.svg'
  },
  {
    name: 'Composition Notebook',
    description: 'Standard composition notebook for essays and creative writing',
    price: 3000,
    sku: 'COMP-NB-01',
    stock_quantity: 80,
    image_url: '/static/placeholder.svg'
  },
  {
    name: 'Graph Paper Pad',
    description: 'Graph paper pad for mathematics and technical drawings',
    price: 1800,
    sku: 'GRAPH-PAD',
    stock_quantity: 60,
    image_url: '/static/placeholder.svg'
  },

  // Writing Materials
  {
    name: 'Blue Ballpoint Pen (Pack of 5)',
    description: 'Smooth writing blue ballpoint pens, pack of 5',
    price: 4000,
    sku: 'PEN-BLUE-5',
    stock_quantity: 200,
    is_featured: true,
    image_url: '/static/placeholder.svg'
  },
  {
    name: 'HB Pencils (Pack of 10)',
    description: 'Standard HB pencils for writing and drawing, pack of 10',
    price: 3500,
    sku: 'PENCIL-HB-10',
    stock_quantity: 120,
    is_featured: true,
    image_url: '/static/placeholder.svg'
  },
  {
    name: 'Eraser Set',
    description: 'Set of 3 high-quality erasers for pencil marks',
    price: 1200,
    sku: 'ERASER-SET',
    stock_quantity: 90,
    image_url: '/static/placeholder.svg'
  },

  // Art Supplies
  {
    name: 'Colored Pencils (24 colors)',
    description: 'Vibrant colored pencils set with 24 different colors',
    price: 8500,
    sku: 'COL-PENCIL-24',
    stock_quantity: 45,
    is_featured: true,
    image_url: '/static/placeholder.svg'
  },
  {
    name: 'Crayons (12 colors)',
    description: 'Non-toxic crayons in 12 bright colors',
    price: 5000,
    sku: 'CRAYON-12',
    stock_quantity: 70,
    image_url: '/static/placeholder.svg'
  },

  // School Bags
  {
    name: 'School Backpack - Blue',
    description: 'Durable school backpack with multiple compartments',
    price: 45000,
    sku: 'BAG-BP-BLUE',
    stock_quantity: 25,
    image_url: '/static/placeholder.svg'
  },
  {
    name: 'Book Bag - Red',
    description: 'Lightweight book bag perfect for carrying textbooks',
    price: 25000,
    sku: 'BAG-BB-RED',
    stock_quantity: 30,
    image_url: '/static/placeholder.svg'
  },

  // Mathematics
  {
    name: 'Scientific Calculator',
    description: 'Advanced scientific calculator for mathematics and sciences',
    price: 35000,
    sku: 'CALC-SCI-01',
    stock_quantity: 15,
    is_featured: true,
    image_url: '/static/placeholder.svg'
  },
  {
    name: 'Ruler Set (30cm & 15cm)',
    description: 'Clear plastic rulers - 30cm and 15cm set',
    price: 2800,
    sku: 'RULER-SET',
    stock_quantity: 85,
    image_url: '/static/placeholder.svg'
  },

  // Science Equipment
  {
    name: 'Microscope Slides (Pack of 20)',
    description: 'Glass microscope slides for biology experiments',
    price: 12000,
    sku: 'MIC-SLIDE-20',
    stock_quantity: 20,
    image_url: '/static/placeholder.svg'
  },
  {
    name: 'Test Tubes Set',
    description: 'Set of 6 test tubes with rack for chemistry experiments',
    price: 18000,
    sku: 'TEST-TUBE-SET',
    stock_quantity: 12,
    image_url: '/static/placeholder.svg'
  }
];

async function seedData() {
  console.log('🌱 Starting to seed Supabase with sample data...');

  try {
    // Insert categories first
    console.log('📂 Inserting categories...');
    const { data: insertedCategories, error: categoriesError } = await supabase
      .from('categories')
      .upsert(categories, { onConflict: 'slug' })
      .select();

    if (categoriesError) {
      console.error('❌ Error inserting categories:', categoriesError);
      return;
    }

    console.log(`✅ Inserted ${insertedCategories.length} categories`);

    // Create a mapping of category slugs to IDs
    const categoryMap = {};
    insertedCategories.forEach(cat => {
      categoryMap[cat.slug] = cat.id;
    });

    // Assign category IDs to products
    const productsWithCategories = products.map(product => {
      let categoryId;
      
      // Determine category based on product type
      if (product.name.includes('Exercise Book') || product.name.includes('Notebook') || product.name.includes('Graph Paper')) {
        categoryId = categoryMap['notebooks-paper'];
      } else if (product.name.includes('Pen') || product.name.includes('Pencil') || product.name.includes('Eraser')) {
        categoryId = categoryMap['writing-materials'];
      } else if (product.name.includes('Colored') || product.name.includes('Crayon')) {
        categoryId = categoryMap['art-supplies'];
      } else if (product.name.includes('Backpack') || product.name.includes('Bag')) {
        categoryId = categoryMap['school-bags'];
      } else if (product.name.includes('Calculator') || product.name.includes('Ruler')) {
        categoryId = categoryMap['mathematics'];
      } else if (product.name.includes('Microscope') || product.name.includes('Test Tube')) {
        categoryId = categoryMap['science-equipment'];
      } else {
        categoryId = categoryMap['notebooks-paper']; // Default category
      }

      return {
        ...product,
        category_id: categoryId
      };
    });

    // Insert products
    console.log('📦 Inserting products...');
    const { data: insertedProducts, error: productsError } = await supabase
      .from('products')
      .upsert(productsWithCategories, { onConflict: 'sku' })
      .select();

    if (productsError) {
      console.error('❌ Error inserting products:', productsError);
      return;
    }

    console.log(`✅ Inserted ${insertedProducts.length} products`);

    console.log('🎉 Seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Categories: ${insertedCategories.length}`);
    console.log(`   Products: ${insertedProducts.length}`);
    console.log(`   Featured Products: ${insertedProducts.filter(p => p.is_featured).length}`);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
  }
}

// Run the seeding
seedData();