interface Env {
  DERM_STORE: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const value = await context.env.DERM_STORE.get('appointments');
  return new Response(value || '[]', {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const appointment: any = await context.request.json();
    if (!appointment || !appointment.patientName || !appointment.date || !appointment.time) {
      return new Response(JSON.stringify({ error: 'Datos de la cita inválidos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const existingStr = await context.env.DERM_STORE.get('appointments') || '[]';
    const existing = JSON.parse(existingStr);
    
    // Add the new appointment
    existing.push(appointment);
    
    await context.env.DERM_STORE.put('appointments', JSON.stringify(existing));
    
    return new Response(JSON.stringify({ success: true, appointment }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
};
