const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

const User = require('./models/User');
const Property = require('./models/Property');
const Assessment = require('./models/Assessment');
const Payment = require('./models/Payment');
const Grievance = require('./models/Grievance');
const UnassessedParcel = require('./models/UnassessedParcel');
const Notification = require('./models/Notification');
const { calculatePropertyTax } = require('./services/taxEngine');
const { getMongoUri } = require('./config/db');

const seedData = async () => {
  try {
    await mongoose.connect(getMongoUri(), { dbName: process.env.MONGODB_DB || 'property_tax_portal' });
    console.log('Connected to MongoDB for Seeding...');

    // Atlas users often lack dropDatabase permission, so drop each collection instead
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const { name } of collections) {
      await mongoose.connection.db.dropCollection(name);
    }
    await Promise.all(
      [User, Property, Assessment, Payment, Grievance, UnassessedParcel, Notification].map((Model) =>
        Model.syncIndexes()
      )
    );
    console.log('Collections reset with fresh indexes.');

    // 1. Create Users
    const admin = await User.create({
      name: 'Dr. K. Sundaram (Municipal Commissioner)',
      email: 'admin@vem.gov.in',
      password: 'admin123',
      role: 'admin',
      phone: '+91 94432 10001',
      dateOfBirth: new Date('1975-06-15'),
      isDifferentlyAbled: false,
      address: 'Municipal Revenue Directorate, Central Office',
    });

    const citizen1 = await User.create({
      name: 'Ramanathan S',
      email: 'raman@vem.gov.in',
      password: 'citizen123',
      role: 'citizen',
      phone: '+91 98421 55678',
      dateOfBirth: new Date('1956-03-22'), // Age 70 -> Senior Citizen 15% discount
      isDifferentlyAbled: false,
      address: 'Plot 42, Cross Cut Road, Gandhipuram, Coimbatore',
    });

    const citizen2 = await User.create({
      name: 'Ananya Roy',
      email: 'ananya@vem.gov.in',
      password: 'citizen123',
      role: 'citizen',
      phone: '+91 97890 23456',
      dateOfBirth: new Date('1990-08-14'), // Age 36
      isDifferentlyAbled: true, // Differently Abled 20% discount
      address: 'Flat 3B, Lakeview Enclave, RS Puram, Coimbatore',
    });

    console.log('Demo Users seeded:');
    console.log('Admin: admin@vem.gov.in / admin123');
    console.log('Citizen 1 (Senior): raman@vem.gov.in / citizen123');
    console.log('Citizen 2 (Differently Abled): ananya@vem.gov.in / citizen123');

    // 2. Create Properties
    // Property 1: Ramanathan's Residential House
    const prop1 = await Property.create({
      owner: citizen1._id,
      propertyIdentifier: 'PID-2026-1001',
      ownerName: citizen1.name,
      propertyType: 'Residential',
      buildingType: 'Pucca/RCC',
      constructionYear: 2012,
      location: {
        district: 'Coimbatore',
        municipality: 'Coimbatore City Corporation',
        ward: 'Ward 14 (Gandhipuram)',
        street: 'Cross Cut 5th Street',
        doorNo: '42/1',
        pincode: '641012',
      },
      gisCoordinates: { lat: 11.0185, lng: 76.9672 },
      landAreaSqFt: 2400,
      builtUpAreaSqFt: 1850,
      occupancyStatus: 'Owner Occupied',
      complianceScore: { score: 92, rating: 'Good', lastEvaluated: new Date() },
    });

    // Property 2: Ramanathan's Commercial Shop
    const prop2 = await Property.create({
      owner: citizen1._id,
      propertyIdentifier: 'PID-2026-1002',
      ownerName: citizen1.name,
      propertyType: 'Commercial',
      buildingType: 'Pucca/RCC',
      constructionYear: 2017,
      location: {
        district: 'Coimbatore',
        municipality: 'Coimbatore City Corporation',
        ward: 'Ward 12 (Town Hall)',
        street: 'Big Bazaar Street',
        doorNo: '108',
        pincode: '641001',
      },
      gisCoordinates: { lat: 11.0022, lng: 76.9625 },
      landAreaSqFt: 1200,
      builtUpAreaSqFt: 1100,
      occupancyStatus: 'Rented',
      complianceScore: { score: 72, rating: 'At Risk', lastEvaluated: new Date() },
    });

    // Property 3: Ananya's Residential Apartment
    const prop3 = await Property.create({
      owner: citizen2._id,
      propertyIdentifier: 'PID-2026-1003',
      ownerName: citizen2.name,
      propertyType: 'Residential',
      buildingType: 'Pucca/RCC',
      constructionYear: 2020,
      location: {
        district: 'Coimbatore',
        municipality: 'Coimbatore City Corporation',
        ward: 'Ward 7 (RS Puram)',
        street: 'Diwan Bahadur Road',
        doorNo: '3B, Lakeview',
        pincode: '641002',
      },
      gisCoordinates: { lat: 11.0094, lng: 76.9456 },
      landAreaSqFt: 1500,
      builtUpAreaSqFt: 1350,
      occupancyStatus: 'Owner Occupied',
      complianceScore: { score: 96, rating: 'Good', lastEvaluated: new Date() },
    });

    // Property 4: Agricultural Land for demonstration
    const prop4 = await Property.create({
      owner: citizen1._id,
      propertyIdentifier: 'PID-2026-1004',
      ownerName: citizen1.name,
      propertyType: 'Agricultural',
      buildingType: 'Vacant Plot',
      constructionYear: 2000,
      location: {
        district: 'Coimbatore',
        municipality: 'Coimbatore North Fringe',
        ward: 'Ward 28 (Saravanampatti)',
        street: 'Thudiyalur Agro Highway',
        doorNo: 'Survey 112/4',
        pincode: '641035',
      },
      gisCoordinates: { lat: 11.0782, lng: 76.9941 },
      landAreaSqFt: 10890, // 0.25 acre
      builtUpAreaSqFt: 0,
      occupancyStatus: 'Owner Occupied',
      complianceScore: { score: 88, rating: 'Good', lastEvaluated: new Date() },
    });

    console.log('Sample Properties created with GIS coordinates.');

    // 3. Create Assessments & Payments
    // Assessment 1: Prop 1 (2024-2025) - Paid in full with receipt
    const calc1 = calculatePropertyTax(prop1, citizen1);
    const dueDatePast = new Date('2025-03-31');
    const asm1 = await Assessment.create({
      property: prop1._id,
      user: citizen1._id,
      financialYear: '2024-2025',
      calculationBreakdown: calc1,
      status: 'Paid',
      dueDate: dueDatePast,
      paidDate: new Date('2025-02-15'),
      assessmentNumber: 'ASM-2024-00101',
    });

    const payment1 = await Payment.create({
      assessment: asm1._id,
      property: prop1._id,
      user: citizen1._id,
      receiptNumber: 'RCPT-2025-884210',
      transactionId: 'TXN-1710500123-4512',
      amountPaid: calc1.netPayableAmount,
      paymentMethod: 'UPI',
      paymentDate: new Date('2025-02-15'),
      status: 'Success',
      breakdownSnapshot: {
        grossTax: calc1.grossTaxAmount,
        exemptions: calc1.totalExemptionAmount,
        latePenalty: 0,
        netPaid: calc1.netPayableAmount,
      },
    });

    asm1.payment = payment1._id;
    await asm1.save();

    // Assessment 2: Prop 1 (2025-2026) - Current Pending Assessment for self-assessment flow
    const calc2 = calculatePropertyTax(prop1, citizen1);
    const dueDateCurrent = new Date();
    dueDateCurrent.setDate(dueDateCurrent.getDate() + 25);
    await Assessment.create({
      property: prop1._id,
      user: citizen1._id,
      financialYear: '2025-2026',
      calculationBreakdown: calc2,
      status: 'Pending',
      dueDate: dueDateCurrent,
      assessmentNumber: 'ASM-2025-00102',
    });

    // Assessment 3: Prop 2 (Commercial) - Disputed with a Grievance
    const calc3 = calculatePropertyTax(prop2, citizen1);
    const asm3 = await Assessment.create({
      property: prop2._id,
      user: citizen1._id,
      financialYear: '2025-2026',
      calculationBreakdown: calc3,
      status: 'Disputed',
      dueDate: dueDateCurrent,
      assessmentNumber: 'ASM-2025-00103',
    });

    // Create Grievance for Assessment 3
    await Grievance.create({
      grievanceNumber: 'GRV-2026-0001',
      user: citizen1._id,
      property: prop2._id,
      assessment: asm3._id,
      disputeType: 'Incorrect Built-up Area',
      description: 'The property record lists 1100 sq ft, but actual approved municipal blueprint area is only 850 sq ft due to mezzanine demolition last year.',
      proofDocumentUrl: '',
      status: 'Under Review',
      originalTaxAmount: calc3.netPayableAmount,
      adminRemarks: '',
    });

    // Assessment 4: Ananya's property (2025-2026) - Pending with Differently Abled Exemption
    const calc4 = calculatePropertyTax(prop3, citizen2);
    await Assessment.create({
      property: prop3._id,
      user: citizen2._id,
      financialYear: '2025-2026',
      calculationBreakdown: calc4,
      status: 'Pending',
      dueDate: dueDateCurrent,
      assessmentNumber: 'ASM-2025-00104',
    });

    console.log('Assessments and Grievance seeded.');

    // 4. Create Novelty GIS Unassessed Parcels (Satellite Anomaly Flags)
    await UnassessedParcel.create([
      {
        parcelId: 'GIS-PARCEL-2026-081',
        surveyNumber: '44/2A',
        locationName: 'Opposite Fun Republic Mall, Peelamedu',
        ward: 'Ward 22',
        gisCoordinates: { lat: 11.0285, lng: 76.9998 },
        estimatedLandAreaSqFt: 4500,
        estimatedBuiltUpAreaSqFt: 3800,
        detectedBuildingType: 'Commercial Complex / Showroom',
        estimatedAnnualTaxLoss: 128000,
        status: 'Uninspected',
        adminActionRemarks: 'Identified via high-resolution satellite imagery overlay. No tax registration on record.',
      },
      {
        parcelId: 'GIS-PARCEL-2026-094',
        surveyNumber: '119/1B',
        locationName: 'Near Brookefields Sub-Road, Sukrawarpet',
        ward: 'Ward 10',
        gisCoordinates: { lat: 11.0118, lng: 76.9535 },
        estimatedLandAreaSqFt: 3200,
        estimatedBuiltUpAreaSqFt: 2900,
        detectedBuildingType: 'Multi-Tenant Commercial / Warehouse',
        estimatedAnnualTaxLoss: 94000,
        status: 'Notice Issued',
        adminActionRemarks: 'Survey notice dispatched to occupant. Scheduled for physical measurement.',
      },
      {
        parcelId: 'GIS-PARCEL-2026-105',
        surveyNumber: '201/3',
        locationName: 'Avinashi Road Expansion Zone, Sitra',
        ward: 'Ward 31',
        gisCoordinates: { lat: 11.0345, lng: 77.0315 },
        estimatedLandAreaSqFt: 6000,
        estimatedBuiltUpAreaSqFt: 4200,
        detectedBuildingType: 'Industrial Workshop',
        estimatedAnnualTaxLoss: 175000,
        status: 'Uninspected',
        adminActionRemarks: 'Unregistered construction detected in late 2025 satellite scan.',
      },
    ]);

    console.log('GIS Unassessed Parcels seeded.');

    // 5. Create Sample Notifications
    await Notification.create([
      {
        user: citizen1._id,
        title: 'Tax Assessment Ready for Self-Assessment',
        message: 'Your property PID-2026-1001 assessment for FY 2025-2026 is due in 25 days. Senior citizen rebate auto-applied.',
        type: 'assessment_due',
        propertyId: prop1._id,
      },
      {
        user: citizen1._id,
        title: 'Dispute Status Update',
        message: 'Grievance GRV-2026-0001 for PID-2026-1002 is currently Under Review by Municipal Revenue Assessors.',
        type: 'grievance_status',
        propertyId: prop2._id,
      },
      {
        user: citizen2._id,
        title: 'Differently Abled Concession Applied',
        message: 'Your 20% differently-abled municipal tax exemption has been verified and applied to PID-2026-1003.',
        type: 'general',
        propertyId: prop3._id,
      },
    ]);

    console.log('Notifications seeded.');
    console.log('Database Seeding Completed Successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding Error:', err);
    process.exit(1);
  }
};

seedData();
