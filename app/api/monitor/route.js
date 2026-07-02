import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

// Inicializar cliente de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Inicializar cliente de Twilio
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const twilioFrom = `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`;
// Soportar múltiples números separados por coma
const whatsappToList = process.env.WHATSAPP_TO ? process.env.WHATSAPP_TO.split(',') : [];

export async function GET(request) {
  try {
    console.log('Iniciando monitoreo de SECOP II...');

    // 1. Consultar a Socrata (Últimos 30 días, buscando palabras clave)
    const hoy = new Date();
    hoy.setDate(hoy.getDate() - 30);
    const fechaMin = hoy.toISOString().split('T')[0] + 'T00:00:00.000';

    const where = `fecha_de_publicacion_del >= '${fechaMin}' AND (` +
      `upper(descripci_n_del_procedimiento) like '%EVENTO%' OR ` +
      `upper(descripci_n_del_procedimiento) like '%PRESTACION%' OR ` +
      `upper(descripci_n_del_procedimiento) like '%PRESTACIÓN%' OR ` +
      `upper(descripci_n_del_procedimiento) like '%LOGISTICA%' OR ` +
      `upper(descripci_n_del_procedimiento) like '%LOGÍSTICA%' OR ` +
      `upper(descripci_n_del_procedimiento) like '%TARIMA%' OR ` +
      `upper(descripci_n_del_procedimiento) like '%SILLAS%' OR ` +
      `upper(descripci_n_del_procedimiento) like '%SONIDO%' OR ` +
      `upper(descripci_n_del_procedimiento) like '%PANTALLA%' OR ` +
      `upper(descripci_n_del_procedimiento) like '%CARPA%')`;

    const query = new URLSearchParams({
      '$where': where,
      '$order': 'fecha_de_publicacion_del DESC',
      '$limit': '50' // Bajamos de nuevo el límite a 50
    });

    const url = `https://www.datos.gov.co/resource/p6dx-8zbt.json?${query.toString()}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error('Error al consultar Socrata');
    const licitaciones = await response.json();

    let nuevasLicitaciones = [];

    // 2. Filtrar las que ya existen en Supabase (Deduplicación)
    for (const lic of licitaciones) {
      const id = lic.id_del_proceso;

      const { data, error } = await supabase
        .from('licitaciones_notificadas')
        .select('secop_id')
        .eq('secop_id', id)
        .single();

      if (!data) {
        nuevasLicitaciones.push(lic);
        // Ya NO guardamos en la base de datos aquí. Lo haremos SOLO cuando se envíe el WhatsApp.
      }
    }

    // 3. Enviar alertas por Twilio WhatsApp
    let mensajesEnviados = 0;

    // LÍMITE DE DEMOSTRACIÓN: Enviar máximo 1 mensaje de la lista de nuevas
    const licitacionesAEnviar = nuevasLicitaciones.slice(0, 1);

    for (const lic of licitacionesAEnviar) {
      const presupuesto = parseInt(lic.precio_base || 0).toLocaleString('es-CO');
      const link = lic.urlproceso ? lic.urlproceso.url : 'No disponible';

      // Armar el mensaje formateado
      const mensaje = `🎯 *NUEVA LICITACIÓN SECOP II*\n\n` +
        `🆔 *Proceso ID:* ${lic.id_del_proceso}\n` +
        `📋 *Entidad:* ${lic.entidad}\n` +
        `📍 *Ubicación:* ${lic.departamento_entidad}\n` +
        `💰 *Presupuesto:* $${presupuesto} COP\n\n` +
        `📝 *Descripción:* ${lic.descripci_n_del_procedimiento}\n\n` +
        `🔗 *Enlace:* ${link}`;

      // Enviar a cada número configurado
      for (const numeroDestino of whatsappToList) {
        try {
          await twilioClient.messages.create({
            body: mensaje,
            from: twilioFrom,
            to: `whatsapp:${numeroDestino.trim()}`
          });
          mensajesEnviados++;

          // Marcar como notificada en la BD SOLO si se envió el mensaje
          await supabase
            .from('licitaciones_notificadas')
            .insert([{ secop_id: lic.id_del_proceso }]);
        } catch (twError) {
          console.error(`Error enviando a ${numeroDestino}:`, twError.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      mensaje: 'Monitoreo y notificaciones ejecutados',
      totalEncontradasSocrata: licitaciones.length,
      totalNuevas: nuevasLicitaciones.length,
      mensajesWhatsAppEnviados: mensajesEnviados
    });

  } catch (error) {
    console.error('Error en el cron:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
