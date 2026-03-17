const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const axios = require('axios');


// ✅ CREATE BOOKING + INIT PAYSTACK PAYMENT
router.post('/', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      room_type,
      check_in,
      check_out,
      amount
    } = req.body;

    // 1️⃣ Save booking first
    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .insert([
        {
          name,
          email,
          phone,
          room_type,
          check_in,
          check_out,
          amount,
          status: 'pending'
        }
      ])
      .select()
      .single();

    if (bookingError) throw bookingError;

    // 2️⃣ Initialize Paystack payment
    const paystackRes = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: amount * 100, // Paystack uses kobo
        metadata: {
          booking_id: bookingData.id
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.sk_test_41e5f44b96e9787e677f871839e79bf885fc1b2d}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const paymentLink = paystackRes.data.data.authorization_url;

    res.status(201).json({
      message: 'Booking created. Proceed to payment.',
      payment_url: paymentLink,
      booking: bookingData
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ PAYSTACK WEBHOOK
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;

    // Only handle successful payments
    if (event.event === 'charge.success') {
      const bookingId = event.data.metadata.booking_id;

      // Update booking status
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'paid' })
        .eq('id', bookingId);

      if (error) throw error;
    }

    res.sendStatus(200);

  } catch (error) {
    console.error(error.message);
    res.sendStatus(500);
  }
});