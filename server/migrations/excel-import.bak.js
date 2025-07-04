const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { getDatabase } = require('../src/models/database');

class ExcelMigration {
  constructor() {
    this.db = getDatabase();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async run() {
    console.log('🚌 PSC Bus Management System - Excel Migration Tool');
    console.log('=' .repeat(60));
    
    try {
      // Step 1: Find Excel files
      const excelFiles = this.findExcelFiles();
      if (excelFiles.length === 0) {
        console.log('❌ No Excel files found in migrations directory.');
        console.log('📁 Please place your Excel file in: server/migrations/');
        console.log('📋 Expected columns: Passenger ID, FullName, Boarding Area, RouteID, Current Balance');
        return;
      }

      // Step 2: Select file to import
      const selectedFile = await this.selectFile(excelFiles);
      
      // Step 3: Preview data
      const data = this.readExcelFile(selectedFile);
      await this.previewData(data);
      
      // Step 4: Setup routes and locations
      const routeMapping = await this.setupRoutes(data);
      
      // Step 5: Import passengers
      await this.importPassengers(data, routeMapping);
      
      console.log('✅ Migration completed successfully!');
      
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      console.error('Stack trace:', error.stack);
    } finally {
      this.rl.close();
    }
  }

  findExcelFiles() {
    const migrationsDir = __dirname;
    const files = fs.readdirSync(migrationsDir);
    return files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === '.xlsx' || ext === '.xls';
    });
  }

  async selectFile(files) {
    if (files.length === 1) {
      console.log(`📄 Found Excel file: ${files[0]}`);
      return files[0];
    }

    console.log('📄 Multiple Excel files found:');
    files.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });

    const answer = await this.question('Select file number: ');
    const fileIndex = parseInt(answer) - 1;
    
    if (fileIndex < 0 || fileIndex >= files.length) {
      throw new Error('Invalid file selection');
    }
    
    return files[fileIndex];
  }

  readExcelFile(filename) {
    const filePath = path.join(__dirname, filename);
    console.log(`📖 Reading Excel file: ${filename}`);
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with header row
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📊 Found ${jsonData.length} rows of data`);
    
    // Debug: Show first row structure
    if (jsonData.length > 0) {
      console.log('📋 First row structure:', Object.keys(jsonData[0]));
      console.log('📋 First row data:', jsonData[0]);
    }
    
    // Validate required columns
    if (jsonData.length > 0) {
      const firstRow = jsonData[0];
      const requiredFields = ['Passenger ID', 'FullName', 'Boarding Area', 'Route ID', 'Current Balance'];
      
      // Check for exact matches first
      const exactMatches = requiredFields.filter(field => field in firstRow);
      
      if (exactMatches.length === requiredFields.length) {
        console.log('✅ All required columns found with exact names');
        return jsonData;
      } else {
        console.log('⚠️  Some columns need mapping:');
        console.log('Available columns:', Object.keys(firstRow));
        console.log('Required columns:', requiredFields);
        console.log('Exact matches found:', exactMatches);
        
        // Try to auto-map
        const mappedData = this.mapColumns(jsonData);
        return mappedData;
      }
    }
    
    return jsonData;
  }

  mapColumns(data) {
    console.log('🔄 Attempting to auto-map columns...');
    
    const firstRow = data[0];
    const availableColumns = Object.keys(firstRow);
    
    console.log('Available columns in Excel:', availableColumns);
    
    const columnMappings = {
      'passengerId': ['Passenger ID', 'PassengerID', 'ID', 'passenger_id', 'id'],
      'fullName': ['FullName', 'Full Name', 'Name', 'full_name', 'FULLNAME'],
      'currentBalance': ['Current Balance', 'Balance', 'current_balance', 'BALANCE', 'Amount'],
      'boardingArea': ['Boarding Area', 'BoardingArea', 'boarding_area', 'area'],
      'routeId': ['Route ID', 'RouteID', 'Route', 'route_id', 'route']
    };
    
    const mapping = {};
    
    // Find exact matches first, then fuzzy matches
    Object.keys(columnMappings).forEach(targetField => {
      const possibleColumns = columnMappings[targetField];
      
      // Try exact match first
      let matchedColumn = availableColumns.find(availCol => 
        possibleColumns.some(possibleCol => 
          availCol.trim() === possibleCol.trim()
        )
      );
      
      // If no exact match, try case-insensitive match
      if (!matchedColumn) {
        matchedColumn = availableColumns.find(availCol => 
          possibleColumns.some(possibleCol => 
            availCol.toLowerCase().trim() === possibleCol.toLowerCase().trim()
          )
        );
      }
      
      // If still no match, try contains match
      if (!matchedColumn) {
        matchedColumn = availableColumns.find(availCol => 
          possibleColumns.some(possibleCol => 
            availCol.toLowerCase().includes(possibleCol.toLowerCase()) ||
            possibleCol.toLowerCase().includes(availCol.toLowerCase())
          )
        );
      }
      
      if (matchedColumn) {
        mapping[targetField] = matchedColumn;
      }
    });
    
    console.log('📋 Column mapping result:', mapping);
    
    // Validate that we found the essential mappings
    const essentialFields = ['passengerId', 'fullName', 'boardingArea', 'routeId', 'currentBalance'];
    const missingMappings = essentialFields.filter(field => !mapping[field]);
    
    if (missingMappings.length > 0) {
      console.log('❌ Could not map essential columns:', missingMappings);
      console.log('Available columns:', availableColumns);
      throw new Error(`Could not map required columns: ${missingMappings.join(', ')}`);
    }
    
    // Transform data using mapping
    const transformedData = data.map((row, index) => {
      const transformed = {
        'Passenger ID': row[mapping.passengerId] || null,
        'FullName': row[mapping.fullName] || 'Unknown',
        'Boarding Area': row[mapping.boardingArea] || 'Unassigned',
        'Route ID': row[mapping.routeId] || null,
        'Current Balance': parseFloat(row[mapping.currentBalance]) || 0.00,
        _originalRow: row // Keep original for reference
      };
      
      // Debug log for first few rows
      if (index < 3) {
        console.log(`Row ${index + 1} transformation:`, {
          original: {
            [mapping.passengerId]: row[mapping.passengerId],
            [mapping.fullName]: row[mapping.fullName],
            [mapping.currentBalance]: row[mapping.currentBalance]
          },
          transformed: {
            'Passenger ID': transformed['Passenger ID'],
            'FullName': transformed['FullName'],
            'Boarding Area': transformed['Boarding Area'],
            'Route ID': transformed['Route ID'],
            'Current Balance': transformed['Current Balance']
          }
        });
      }
      
      return transformed;
    });
    
    console.log(`✅ Transformed ${transformedData.length} rows`);
    return transformedData;
  }

  async previewData(data) {
    console.log('\n📋 Data Preview:');
    console.log('-'.repeat(80));
    
    // Show first 5 rows
    const preview = data.slice(0, 5);
    preview.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row['Passenger ID']}, Name: ${row['FullName']}, Boarding Area: ${row['Boarding Area']}, Route ID: ${row['Route ID']}, Balance: ${row['Current Balance']}`);
    });
    
    if (data.length > 5) {
      console.log(`... and ${data.length - 5} more rows`);
    }
    
    console.log('-'.repeat(80));
    
    // Statistics
    const balances = data.map(row => parseFloat(row['Current Balance']) || 0);
    const negativeBalances = balances.filter(b => b < 0).length;
    const zeroBalances = balances.filter(b => b === 0).length;
    const positiveBalances = balances.filter(b => b > 0).length;
    
    console.log(`📊 Balance Statistics:`);
    console.log(`   Positive balances: ${positiveBalances}`);
    console.log(`   Zero balances: ${zeroBalances}`);
    console.log(`   Negative balances: ${negativeBalances}`);
    console.log(`   Total records: ${data.length}`);
    
    const proceed = await this.question('\n✅ Proceed with import? (y/n): ');
    if (proceed.toLowerCase() !== 'y') {
      throw new Error('Import cancelled by user');
    }
  }

  async setupRoutes(data) {
    console.log('\n🛣️  Setting up routes and boarding areas...');
    
    // Extract unique boarding areas from data (if available)
    const boardingAreas = [...new Set(
      data.map(row => row._originalRow?.['Boarding Area'] || row['Boarding Area'])
        .filter(area => area && area.trim())
    )];
    
    if (boardingAreas.length === 0) {
      console.log('⚠️  No boarding areas found in Excel data.');
      console.log('📍 Creating default boarding areas...');
      
      // Create default routes
      const defaultAreas = ['Glen View 3', 'Glen View 1', 'Glen View 2', 'Glen Norah A', 'Glen Norah B', 'Highfield'];
      const routeMapping = {};
      
      for (const area of defaultAreas) {
        const route = this.db.createRoute({
          name: `Town - ${area}`,
          boardingArea: area,
          distanceKm: 10,
          baseFare: 6.35
        });
        routeMapping[area] = route.id;
        console.log(`✅ Created route: ${route.name}`);
      }
      
      return routeMapping;
    }
    
    // Create routes from detected boarding areas
    const routeMapping = {};
    for (const area of boardingAreas) {
      const route = this.db.createRoute({
        name: `Route - ${area}`,
        boardingArea: area,
        distanceKm: 10,
        baseFare: 6.35
      });
      routeMapping[area] = route.id;
      console.log(`✅ Created route: ${route.name}`);
    }
    
    // Handle passengers without boarding areas
    const defaultRoute = this.db.createRoute({
      name: 'Default Route',
      boardingArea: 'Unassigned',
      distanceKm: 10,
      baseFare: 6.35
    });
    routeMapping['_default'] = defaultRoute.id;
    
    return routeMapping;
  }

  async importPassengers(data, routeMapping) {
    console.log('\n👥 Importing passengers...');
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // Determine route
        const boardingArea = row._originalRow?.['Boarding Area'] || row['Boarding Area'];
        const routeId = routeMapping[boardingArea] || routeMapping['_default'];
        
        // Clean and validate data
        const passengerData = {
          legacyPassengerId: parseInt(row['Passenger ID']) || null,
          fullName: (row['FullName'] || '').trim(),
          ministry: row._originalRow?.['Ministry'] || row['Ministry'] || 'Not Specified',
          boardingArea: boardingArea || 'Unassigned',
          routeId: routeId,
          currentBalance: parseFloat(row['Current Balance']) || 0.00
        };
        
        // Validate required fields
        if (!passengerData.fullName) {
          throw new Error('Full name is required');
        }
        
        // Create passenger
        const passenger = this.db.createPassenger(passengerData);
        successCount++;
        
        // Show progress every 50 records
        if ((i + 1) % 50 === 0) {
          console.log(`📊 Progress: ${i + 1}/${data.length} (${successCount} successful, ${errorCount} errors)`);
        }
        
      } catch (error) {
        errorCount++;
        errors.push(`Row ${i + 1}: ${error.message}`);
        
        if (errors.length <= 10) { // Only show first 10 errors
          console.log(`❌ Error on row ${i + 1}: ${error.message}`);
        }
      }
    }
    
    console.log('\n📊 Import Summary:');
    console.log(`✅ Successfully imported: ${successCount} passengers`);
    console.log(`❌ Errors: ${errorCount}`);
    
    if (errors.length > 10) {
      console.log(`⚠️  Showing first 10 errors only. Total errors: ${errors.length}`);
    }
    
    // Create summary report
    this.generateImportReport(successCount, errorCount, errors);
  }

  generateImportReport(successCount, errorCount, errors) {
    const reportPath = path.join(__dirname, `import_report_${Date.now()}.txt`);
    
    const report = [
      'PSC Bus Management System - Import Report',
      '=' .repeat(50),
      `Import Date: ${new Date().toISOString()}`,
      `Successful Imports: ${successCount}`,
      `Failed Imports: ${errorCount}`,
      '',
      'Errors:',
      ...errors,
      '',
      'Next Steps:',
      '1. Review any failed imports and correct data if needed',
      '2. Assign conductors to routes in the admin panel',
      '3. Set appropriate fare amounts for each route',
      '4. Test the system with a few boarding transactions'
    ].join('\n');
    
    fs.writeFileSync(reportPath, report);
    console.log(`📄 Import report saved: ${reportPath}`);
  }

  question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new ExcelMigration();
  migration.run().catch(console.error);
}

module.exports = ExcelMigration;