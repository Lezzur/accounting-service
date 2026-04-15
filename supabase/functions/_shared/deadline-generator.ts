const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface DeadlineRow {
  client_id: string;
  deadline_type: string;
  due_date: string;
  period_label: string;
  status: string;
}

function formatDate(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function addMonths(year: number, month0: number, count: number): [number, number] {
  const total = month0 + count;
  return [year + Math.floor(total / 12), total % 12];
}

export function generateDeadlinesForClient(
  clientId: string,
  birRegistrationType: 'vat' | 'non_vat',
  fiscalYearStartMonth: number,
  referenceDate: Date,
): DeadlineRow[] {
  const rows: DeadlineRow[] = [];
  const startYear = referenceDate.getFullYear();
  const startMonth0 = referenceDate.getMonth();

  // Monthly deadlines for the next 12 months
  for (let i = 0; i < 12; i++) {
    const [periodYear, periodMonth0] = addMonths(startYear, startMonth0, i);
    const periodLabel = `${MONTH_NAMES[periodMonth0]} ${periodYear}`;

    const [dueYear, dueMonth0] = addMonths(periodYear, periodMonth0, 1);

    rows.push({
      client_id: clientId,
      deadline_type: 'monthly_bookkeeping',
      due_date: formatDate(dueYear, dueMonth0 + 1, 15),
      period_label: periodLabel,
      status: 'upcoming',
    });

    if (birRegistrationType === 'vat') {
      rows.push({
        client_id: clientId,
        deadline_type: 'monthly_vat',
        due_date: formatDate(dueYear, dueMonth0 + 1, 20),
        period_label: periodLabel,
        status: 'upcoming',
      });
    }
  }

  // Quarterly deadlines — boundaries shift with fiscal year start
  const fyStart0 = fiscalYearStartMonth - 1;
  const quarterEndMonths0 = [
    (fyStart0 + 2) % 12,
    (fyStart0 + 5) % 12,
    (fyStart0 + 8) % 12,
    (fyStart0 + 11) % 12,
  ];

  for (let i = 0; i < 12; i++) {
    const [year, month0] = addMonths(startYear, startMonth0, i);
    const qIndex = quarterEndMonths0.indexOf(month0);
    if (qIndex === -1) continue;

    const quarterNum = qIndex + 1;
    const periodLabel = `Q${quarterNum} ${year}`;

    const [dueYear, dueMonth0] = addMonths(year, month0, 1);

    for (const dtype of ['quarterly_bir', 'quarterly_financials'] as const) {
      rows.push({
        client_id: clientId,
        deadline_type: dtype,
        due_date: formatDate(dueYear, dueMonth0 + 1, 25),
        period_label: periodLabel,
        status: 'upcoming',
      });
    }
  }

  // Annual deadlines — April 15 filing date
  // For calendar-year filers (fiscal_year_start=1): FY 2025 → filed April 15 2026
  // The FY label uses the year the fiscal year ends
  const fyEnd0 = (fyStart0 + 11) % 12;

  const windowStart = referenceDate.getTime();
  const windowEnd = new Date(startYear, startMonth0 + 12, 1).getTime();

  for (let y = startYear; y <= startYear + 2; y++) {
    const apr15 = new Date(y, 3, 15);
    if (apr15.getTime() < windowStart || apr15.getTime() >= windowEnd) continue;

    // Determine which fiscal year this April 15 filing covers
    // Standard: FY ending in the prior calendar year for Jan-start filers
    // For non-Jan start: the FY that ended most recently before April 15
    let fyEndYear: number;
    if (fyStart0 === 0) {
      fyEndYear = y - 1;
    } else if (fyEnd0 < 3) {
      // FY ends Jan-Mar of year y → FY label = year y
      fyEndYear = y;
    } else {
      // FY ends Apr-Dec of year y-1 → FY label = year y-1
      fyEndYear = y - 1;
    }

    const periodLabel = `FY ${fyEndYear}`;

    for (const dtype of ['annual_itr', 'annual_financials'] as const) {
      rows.push({
        client_id: clientId,
        deadline_type: dtype,
        due_date: formatDate(y, 4, 15),
        period_label: periodLabel,
        status: 'upcoming',
      });
    }
  }

  return rows;
}
