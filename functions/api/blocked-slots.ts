interface Env {
  DERM_STORE: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const value = await context.env.DERM_STORE.get('blocked_slots');
  return new Response(value || '[]', {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const slot: any = await context.request.json();
    if (!slot || !slot.date || !slot.time) {
      return new Response(JSON.stringify({ error: 'Datos de bloqueo inválidos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const existingStr = await context.env.DERM_STORE.get('blocked_slots') || '[]';
    const existing = JSON.parse(existingStr);
    
    // Check if already blocked
    const alreadyBlocked = existing.some((s: any) => s.date === slot.date && s.time === slot.time);
    if (!alreadyBlocked) {
      existing.push(slot);
      await context.env.DERM_STORE.put('blocked_slots', JSON.stringify(existing));
    }
    
    return new Response(JSON.stringify({ success: true, slot }), {
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

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const date = url.searchParams.get('date');
    const time = url.searchParams.get('time');

    if (!date || !time) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros de fecha o hora' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const existingStr = await context.env.DERM_STORE.get('blocked_slots') || '[]';
    let existing = JSON.parse(existingStr);
    
    // Filter out the deleted slot
    existing = existing.filter((s: any) => !(s.date === date && s.time === time));
    
    await context.env.DERM_STORE.put('blocked_slots', JSON.stringify(existing));
    
    return new Response(JSON.stringify({ success: true }), {
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
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
};
