import fs from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';

export interface FixturePatient {
  firstName: string;
  lastName: string;
  mobile: string;
  alreadyTexted?: boolean;
}

export async function generateFixture(filePath: string, patients: FixturePatient[], template = 'Hello {firstName}, this is a test message from Hugh\'s Pharmacy.') {
  const rows = [
    [template],
    [''],
    ['First Name', 'Last Name', '', 'Mobile', 'Already Texted'],
    ...patients.map((patient) => [
      patient.firstName,
      patient.lastName,
      '',
      patient.mobile,
      patient.alreadyTexted ? 'TRUE' : '',
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!merges'] = [XLSX.utils.decode_range('A1:E1'), XLSX.utils.decode_range('A2:E2')];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Patients');

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  await fs.writeFile(filePath, buffer);
}
