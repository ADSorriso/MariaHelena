// Configuração pública do convite Maria Helena (não usar chaves secretas aqui).
window.MARIA_CONFIG = {
  supabaseUrl: 'https://jcvjdxlstdrxhcslhlud.supabase.co',
  supabaseAnonKey: 'sb_publishable_FtuVKDBT7p-aGWu9aaylSA_xpg0Xi_4',
  organizerEmail: 'ricaels55@gmail.com'
};

// Compatibilidade com o convite atual: exige WhatsApp nas reservas de presentes.
document.addEventListener('DOMContentLoaded', () => {
  const store = window.MariaStore;
  if (!store || !store.isCloud) {
    console.error('Supabase não conectado. Confira os scripts do convite.');
    return;
  }
  const form = document.getElementById('reserveForm');
  if (form) {
    const label = document.createElement('label');
    label.htmlFor = 'reservePhone';
    label.textContent = 'Seu WhatsApp com DDD';
    const phone = document.createElement('input');
    phone.id = 'reservePhone';
    phone.type = 'tel';
    phone.inputMode = 'tel';
    phone.autocomplete = 'tel-national';
    phone.placeholder = '(65) 99999-9999';
    phone.required = true;
    phone.maxLength = 20;
    const anchor = form.querySelector('label[for="reserveQty"]');
    if (anchor) {
      form.insertBefore(label, anchor);
      form.insertBefore(phone, anchor);
    }
    phone.addEventListener('focus', () => {
      if (!phone.value) phone.value = document.getElementById('guestPhone')?.value || '';
    });
    store.reserveGift = async ({id, name, quantity}) => {
      const digits = phone.value.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
      if (!/^[1-9][0-9](?:[2-9][0-9]{7}|9[0-9]{8})$/.test(digits))
        throw new Error('Informe um WhatsApp válido com DDD.');
      if (!id || String(name || '').trim().length < 2 || !Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 20)
        throw new Error('Confira nome, presente e quantidade.');
      const client = await store.client();
      const {error} = await client.rpc('reserve_baby_gift', {
        p_gift_id: id,
        p_guest_name: String(name).trim(),
        p_qty: Number(quantity),
        p_guest_phone: digits
      });
      if (error) throw new Error(error.message || 'Não foi possível reservar.');
    };
  }
  store.adminReservations = async () => {
    const client = await store.client();
    const {data, error} = await client.from('baby_reservations')
      .select('id,gift_id,guest_name,guest_phone,quantity,created_at')
      .order('created_at', {ascending: false});
    if (error) throw new Error(error.message || 'Não foi possível carregar as reservas.');
    return data || [];
  };
});
