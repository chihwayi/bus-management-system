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
        console.log('📋 Expected columns: Passenger ID, FullName, Boarding Area, Route ID, Current Balance');
        console.log('⚠️  Note: Routes must be created by admin first, then Route ID and Boarding Area should be populated in the Excel file');
        return;
      }

      // Step 2: Select file to import
      const selectedFile = await this.selectFile(excelFiles);
      
      // Step 3: Preview data
      const data = this.readExcelFile(selectedFile);
      await this.previewData(data);
      
      // Step 4: Validate routes exist in database
      await this.validateRoutes(data);
      
      // Step 5: Import passengers
      await this.importPassengers(data);
      
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
        'Boarding Area': row[mapping.boardingArea] || null,
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
            [mapping.boardingArea]: row[mapping.boardingArea],
            [mapping.routeId]: row[mapping.routeId],
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
    
    // Route ID statistics
    const routeIds = data.map(row => row['Route ID']).filter(id => id !== null);
    const uniqueRouteIds = [...new Set(routeIds)];
    const missingRouteIds = data.filter(row => !row['Route ID']).length;
    
    console.log(`🛣️  Route Statistics:`);
    console.log(`   Unique Route IDs: ${uniqueRouteIds.length} (${uniqueRouteIds.join(', ')})`);
    console.log(`   Records with missing Route ID: ${missingRouteIds}`);
    
    if (missingRouteIds > 0) {
      console.log('⚠️  WARNING: Some records have missing Route IDs. These will fail during import.');
    }
    
    const proceed = await this.question('\n✅ Proceed with import? (y/n): ');
    if (proceed.toLowerCase() !== 'y') {
      throw new Error('Import cancelled by user');
    }
  }

  async validateRoutes(data) {
    console.log('\n🔍 Validating routes in database...');
    
    // Get unique Route IDs from data (keep as strings for UUID support)
    const routeIds = [...new Set(
      data.map(row => row['Route ID'])
        .filter(id => id !== null && id !== undefined && id !== '')
        .map(id => String(id).trim())
    )];
    
    if (routeIds.length === 0) {
      throw new Error('No valid Route IDs found in Excel data. Please ensure Route ID column is populated with existing route IDs.');
    }
    
    console.log(`📊 Found ${routeIds.length} unique Route IDs in data:`);
    routeIds.forEach(id => console.log(`   - ${id}`));
    
    // Check if routes exist in database
    const missingRoutes = [];
    const validRoutes = [];
    
    for (const routeId of routeIds) {
      try {
        // Fixed: Use getRoute instead of getRouteById
        const route = this.db.getRoute(routeId);
        if (route) {
          validRoutes.push({ id: routeId, name: route.name, boardingArea: route.boarding_area });
          console.log(`✅ Route ${routeId}: ${route.name} (${route.boarding_area})`);
        } else {
          missingRoutes.push(routeId);
        }
      } catch (error) {
        console.log(`❌ Error checking route ${routeId}: ${error.message}`);
        missingRoutes.push(routeId);
      }
    }
    
    if (missingRoutes.length > 0) {
      console.log(`❌ Missing routes in database:`);
      missingRoutes.forEach(id => console.log(`   - ${id}`));
      throw new Error(`The following Route IDs do not exist in the database: ${missingRoutes.join(', ')}. Please create these routes first through the admin panel.`);
    }
    
    console.log(`✅ All ${validRoutes.length} routes validated successfully`);
    
    // Validate boarding areas match routes
    const boardingAreaMismatches = [];
    
    for (const row of data) {
      const routeId = String(row['Route ID']).trim();
      const boardingArea = row['Boarding Area'];
      
      if (routeId && boardingArea) {
        const route = validRoutes.find(r => r.id === routeId);
        if (route && route.boardingArea !== boardingArea) {
          boardingAreaMismatches.push({
            routeId,
            excelBoardingArea: boardingArea,
            dbBoardingArea: route.boardingArea
          });
        }
      }
    }
    
    if (boardingAreaMismatches.length > 0) {
      console.log('⚠️  WARNING: Boarding area mismatches found:');
      boardingAreaMismatches.slice(0, 5).forEach(mismatch => {
        console.log(`   Route ${mismatch.routeId}: Excel="${mismatch.excelBoardingArea}" vs DB="${mismatch.dbBoardingArea}"`);
      });
      
      if (boardingAreaMismatches.length > 5) {
        console.log(`   ... and ${boardingAreaMismatches.length - 5} more mismatches`);
      }
      
      const proceed = await this.question('Continue with boarding area mismatches? (y/n): ');
      if (proceed.toLowerCase() !== 'y') {
        throw new Error('Import cancelled due to boarding area mismatches');
      }
    }
  }

  async importPassengers(data) {
    console.log('\n👥 Importing passengers...');
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // Validate Route ID (keep as string for UUID support)
        const routeId = String(row['Route ID']).trim();
        if (!routeId || routeId === 'null' || routeId === 'undefined') {
          throw new Error('Invalid or missing Route ID');
        }
        
        // Get boarding area from Excel (will be validated against route)
        const boardingArea = row['Boarding Area'];
        if (!boardingArea || boardingArea.trim() === '') {
          throw new Error('Invalid or missing Boarding Area');
        }
        
        // Clean and validate data
        const passengerData = {
          legacyPassengerId: parseInt(row['Passenger ID']) || null,
          fullName: (row['FullName'] || '').trim(),
          ministry: row._originalRow?.['Ministry'] || row['Ministry'] || 'Not Specified',
          boardingArea: boardingArea.trim(),
          routeId: routeId,
          currentBalance: parseFloat(row['Current Balance']) || 0.00
        };
        
        // Validate required fields
        if (!passengerData.fullName) {
          throw new Error('Full name is required');
        }
        
        // Verify route exists (double-check) - Fixed: Use getRoute instead of getRouteById
        const route = this.db.getRoute(routeId);
        if (!route) {
          throw new Error(`Route ID ${routeId} not found in database`);
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
      'Import Process:',
      '1. Routes were NOT created automatically',
      '2. Route IDs and Boarding Areas were read from Excel file',
      '3. All routes were validated against existing database entries',
      '',
      'Errors:',
      ...errors,
      '',
      'Next Steps:',
      '1. Review any failed imports and correct data if needed',
      '2. Ensure all Route IDs in Excel correspond to existing routes in database',
      '3. Verify boarding areas match the routes in database',
      '4. Test the system with boarding transactions'
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