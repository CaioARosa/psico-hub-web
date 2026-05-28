const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { google } = require('googleapis');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Google Calendar Config
const calendarId = process.env.GOOGLE_CALENDAR_ID;
const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let privateKey = process.env.GOOGLE_PRIVATE_KEY;

// Check if credentials are set and valid
const isGCalConfigured = 
  serviceAccountEmail && 
  serviceAccountEmail !== 'your-service-account-email@your-project-id.iam.gserviceaccount.com' &&
  privateKey && 
  !privateKey.includes('MOCK_PRIVATE_KEY');

let calendar = null;

if (isGCalConfigured) {
  try {
    // Format private key correctly in case newlines were lost
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    const auth = new google.auth.JWT(
      serviceAccountEmail,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/calendar']
    );
    
    calendar = google.calendar({ version: 'v3', auth });
    console.log('✅ Google Calendar JWT Authenticated successfully.');
  } catch (error) {
    console.error('❌ Failed to initialize Google Calendar client:', error);
  }
} else {
  console.log('ℹ️ Google Calendar credentials not fully configured. Running in SIMULATION MODE.');
}

// Available default slots (Lays Coelho work hours)
const DEFAULT_SLOTS = ['09:00', '10:30', '14:00', '15:30', '17:00'];

// Simulation storage (saves bookings locally in memory when in simulation mode)
const SIMULATED_BOOKINGS = [];

/**
 * Route: GET /api/availability
 * Queries Google Calendar FreeBusy API to list available slots for a given date
 */
app.get('/api/availability', async (req, res) => {
  const { date } = req.query; // YYYY-MM-DD format
  
  if (!date) {
    return res.status(400).json({ error: 'Data não informada. Formato esperado: YYYY-MM-DD.' });
  }

  try {
    // Parse target date boundaries (start of day to end of day)
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);
    
    if (!isGCalConfigured || !calendar) {
      // --- SIMULATION MODE ---
      // Filter out simulated bookings that are already booked for this date
      const bookedHours = SIMULATED_BOOKINGS
        .filter(b => b.date === date)
        .map(b => b.time);
      
      const freeSlots = DEFAULT_SLOTS.filter(slot => !bookedHours.includes(slot));
      return res.json({ slots: freeSlots, mode: 'simulation' });
    }

    // --- REAL GOOGLE CALENDAR MODE ---
    // Query Google Calendar FreeBusy API
    const freeBusyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        items: [{ id: calendarId }]
      }
    });

    const busyTimes = freeBusyResponse.data.calendars[calendarId].busy || [];
    
    // Calculate available slots
    const availableSlots = DEFAULT_SLOTS.filter(slot => {
      // Convert slot string to full Date objects for comparison
      const slotStart = new Date(`${date}T${slot}:00`);
      const slotEnd = new Date(slotStart.getTime() + 50 * 60 * 1000); // 50 min session

      // Check if slot overlaps with any busy times
      const isBusy = busyTimes.some(busy => {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        
        // Overlap logic: slot starts before busy ends AND slot ends after busy starts
        return slotStart < busyEnd && slotEnd > busyStart;
      });

      return !isBusy;
    });

    return res.json({ slots: availableSlots, mode: 'production' });

  } catch (error) {
    console.error('Error fetching availability:', error);
    return res.status(500).json({ error: 'Erro ao consultar agenda da psicóloga no Google Calendar.' });
  }
});

/**
 * Route: POST /api/book
 * Inserts booking event directly into Lays' Google Calendar
 */
app.post('/api/book', async (req, res) => {
  const { service, date, time, name, email, phone, message } = req.body;

  if (!service || !date || !time || !name || !phone) {
    return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes.' });
  }

  try {
    const slotStart = new Date(`${date}T${time}:00`);
    const slotEnd = new Date(slotStart.getTime() + 50 * 60 * 1000); // 50 min session

    if (!isGCalConfigured || !calendar) {
      // --- SIMULATION MODE ---
      const simulatedBooking = {
        id: 'sim-' + Math.random().toString(36).substr(2, 9),
        service, date, time, name, email, phone, message,
        timestamp: new Date().toISOString()
      };
      SIMULATED_BOOKINGS.push(simulatedBooking);
      console.log('📝 Simulated Booking Saved:', simulatedBooking);
      return res.json({ success: true, booking: simulatedBooking, mode: 'simulation' });
    }

    // --- REAL GOOGLE CALENDAR MODE ---
    const eventDescription = 
      `Nova consulta agendada pelo site:\n\n` +
      `👤 Nome do Paciente: ${name}\n` +
      `📞 WhatsApp: ${phone}\n` +
      `📧 E-mail: ${email || 'Não informado'}\n` +
      `🧩 Tipo de Sessão: ${service}\n` +
      `💬 Notas/Queixas: ${message || 'Nenhuma observação informada.'}`;

    const event = {
      summary: `Consulta [${service}] - ${name}`,
      description: eventDescription,
      start: {
        dateTime: slotStart.toISOString(),
        timeZone: 'America/Sao_Paulo'
      },
      end: {
        dateTime: slotEnd.toISOString(),
        timeZone: 'America/Sao_Paulo'
      },
      attendees: email ? [{ email }] : [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 60 }
        ]
      }
    };

    const insertedEvent = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: event
    });

    console.log('✅ Google Calendar Event created:', insertedEvent.data.id);
    return res.json({ success: true, eventId: insertedEvent.data.id, mode: 'production' });

  } catch (error) {
    console.error('Error inserting booking event:', error);
    return res.status(500).json({ error: 'Falha ao agendar evento no Google Agenda.' });
  }
});

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', calendarConfigured: isGCalConfigured });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Lays Landing Backend is running on http://localhost:${PORT}`);
});
