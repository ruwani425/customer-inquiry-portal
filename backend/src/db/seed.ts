import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, closePool } from './pool.js';
import { runMigrations } from './migrate.js';

interface SeedUser {
  email: string;
  name: string;
  role: 'staff' | 'supervisor';
  password: string;
}

const SEED_USERS: SeedUser[] = [
  {
    email: 'maya@coffeeninja.local',
    name: 'Maya Perera',
    role: 'staff',
    password: 'StaffPassword123!',
  },
  {
    email: 'liam@coffeeninja.local',
    name: 'Liam Fernando',
    role: 'staff',
    password: 'StaffPassword123!',
  },
  {
    email: 'nadia@coffeeninja.local',
    name: 'Nadia Silva',
    role: 'supervisor',
    password: 'LeadPassword123!',
  },
];

export async function seedDatabase(): Promise<void> {
  await runMigrations();
  const pool = getPool();

  const userIds = new Map<string, string>();
  for (const user of SEED_USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const result = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name, role, password_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name,
             role = EXCLUDED.role,
             password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [user.email, user.name, user.role, passwordHash]
    );
    userIds.set(user.email, result.rows[0].id);
  }

  const countResult = await pool.query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM inquiries'
  );
  if (Number(countResult.rows[0].count) > 0) {
    console.log('Inquiries table already populated; skipping sample inquiry seed.');
    return;
  }

  const mayaId = userIds.get('maya@coffeeninja.local')!;
  const liamId = userIds.get('liam@coffeeninja.local')!;
  const nadiaId = userIds.get('nadia@coffeeninja.local')!;

  const sampleInquiries = [
    {
      customerName: 'Amara Wijesinghe',
      customerContact: 'amara.w@example.com',
      subject: 'Invoice correction for October catering',
      description:
        'Customer asked to update the billing address and resend invoice #INV-2041 before Friday.',
      status: 'IN_PROGRESS',
      lastNote: 'Verified new billing address; waiting on accounts PDF.',
      ownerId: mayaId,
      updatedById: mayaId,
    },
    {
      customerName: 'Daniel Jayawardena',
      customerContact: '+94 77 412 8890',
      subject: 'Reschedule equipment maintenance visit',
      description:
        'Requested moving Thursday morning espresso machine service to Monday 10:00 AM.',
      status: 'NEW',
      lastNote: null,
      ownerId: mayaId,
      updatedById: mayaId,
    },
    {
      customerName: 'Priya De Mel',
      customerContact: 'priya.demel@example.com',
      subject: 'Bulk bean subscription pricing',
      description:
        'Asked for monthly wholesale pricing for 25kg house blend delivery to Kandy.',
      status: 'RESOLVED',
      lastNote: 'Sent wholesale rate sheet and confirmed trial bag dispatch.',
      ownerId: mayaId,
      updatedById: nadiaId,
    },
    {
      customerName: 'Rohan Senanayake',
      customerContact: '+94 71 903 1144',
      subject: 'Damaged grinder hopper on delivery',
      description:
        'Reported a hairline crack on the plastic hopper received this morning; shared order #CN-882.',
      status: 'IN_PROGRESS',
      lastNote: 'Confirmed replacement part is in stock for courier pickup.',
      ownerId: liamId,
      updatedById: liamId,
    },
    {
      customerName: 'Sasha Gunasekara',
      customerContact: 'sasha.g@example.com',
      subject: 'Barista training workshop availability',
      description:
        'Looking to book a 4-person private latte art session in early December.',
      status: 'NEW',
      lastNote: null,
      ownerId: liamId,
      updatedById: liamId,
    },
  ];

  for (const item of sampleInquiries) {
    await pool.query(
      `INSERT INTO inquiries (
         customer_name,
         customer_contact,
         subject,
         description,
         status,
         last_note,
         owner_id,
         updated_by_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        item.customerName,
        item.customerContact,
        item.subject,
        item.description,
        item.status,
        item.lastNote,
        item.ownerId,
        item.updatedById,
      ]
    );
  }

  console.log('Seeded users and sample inquiries.');
}

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  seedDatabase()
    .then(async () => {
      await closePool();
    })
    .catch(async (err) => {
      console.error('Seed failed:', err);
      await closePool();
      process.exit(1);
    });
}

