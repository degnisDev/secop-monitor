import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

// Inicializar cliente de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuración de canales de notificación activos
const ENABLE_WHATSAPP = false; // Desactivado temporalmente
const ENABLE_TELEGRAM = true;  // Activado para pruebas

// Inicializar cliente de Twilio (solo si está habilitado)
const twilioClient = ENABLE_WHATSAPP ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;
const twilioFrom = ENABLE_WHATSAPP ? `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}` : '';
const whatsappToList = (ENABLE_WHATSAPP && process.env.WHATSAPP_TO) ? process.env.WHATSAPP_TO.split(',') : [];

// Configuración de Telegram
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatIds = process.env.TELEGRAM_CHAT_IDS ? process.env.TELEGRAM_CHAT_IDS.split(',') : [];

export async function GET(request) {
  try {
    console.log('Iniciando monitoreo de SECOP II...');

    // 1. Consultar a Socrata (Últimos 30 días, buscando palabras clave)
    const hoy = new Date();
    hoy.setDate(hoy.getDate() - 30);
    const fechaMin = hoy.toISOString().split('T')[0] + 'T00:00:00.000';

    const where = `fecha_de_publicacion_del >= '${fechaMin}' AND (` +
      `upper(descripci_n_del_procedimiento) like '%EVENTO%' OR ` +
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
        // Ya NO guardamos en la base de datos aquí. Lo haremos SOLO cuando se envíe el WhatsApp/Telegram.
      }
    }

    // 3. Enviar alertas
    let mensajesWhatsAppEnviados = 0;
    let mensajesTelegramEnviados = 0;

    // LÍMITE DE DEMOSTRACIÓN: Enviar máximo 1 mensaje de la lista de nuevas
    const licitacionesAEnviar = nuevasLicitaciones.slice(0, 1);

    for (const lic of licitacionesAEnviar) {
      const presupuesto = parseInt(lic.precio_base || 0).toLocaleString('es-CO');
      const link = lic.urlproceso ? lic.urlproceso.url : 'No disponible';

      // Formatear fecha de publicación
      const fechaOriginal = lic.fecha_de_publicacion_del;
      let fechaFormateada = 'No disponible';
      if (fechaOriginal) {
        try {
          const fechaObj = new Date(fechaOriginal);
          fechaFormateada = fechaObj.toLocaleDateString('es-CO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
        } catch (e) {
          fechaFormateada = fechaOriginal;
        }
      }

      // Armar el mensaje formateado
      const mensaje = `🎯 *NUEVA LICITACIÓN SECOP II*\n\n` +
        `🆔 *Proceso ID:* ${lic.id_del_proceso}\n` +
        `📅 *Fecha de publicación:* ${fechaFormateada}\n` +
        `📋 *Entidad:* ${lic.entidad}\n` +
        `📍 *Ubicación:* ${lic.departamento_entidad}\n` +
        `💰 *Presupuesto:* $${presupuesto} COP\n\n` +
        `📝 *Descripción:* ${lic.descripci_n_del_procedimiento}\n\n` +
        `🔗 *Enlace:* ${link}`;

      let notificadoExitosamente = false;

      // --- CANAL WHATSAPP ---
      if (ENABLE_WHATSAPP && twilioClient) {
        for (const numeroDestino of whatsappToList) {
          try {
            await twilioClient.messages.create({
              body: mensaje,
              from: twilioFrom,
              to: `whatsapp:${numeroDestino.trim()}`
            });
            mensajesWhatsAppEnviados++;
            notificadoExitosamente = true;
          } catch (twError) {
            console.error(`Error enviando a WhatsApp ${numeroDestino}:`, twError.message);
          }
        }
      }

      // --- CANAL TELEGRAM ---
      if (ENABLE_TELEGRAM && telegramToken) {
        for (const chatId of telegramChatIds) {
          try {
            const telegramUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
            const response = await fetch(telegramUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId.trim(),
                text: mensaje,
                parse_mode: 'Markdown'
              })
            });

            if (response.ok) {
              mensajesTelegramEnviados++;
              notificadoExitosamente = true;
            } else {
              const errData = await response.json();
              console.error(`Error enviando a Telegram chat ${chatId}:`, errData);
            }
          } catch (tgError) {
            console.error(`Error de red con Telegram para chat ${chatId}:`, tgError.message);
          }
        }
      }

      // Marcar como notificada en la BD si se envió por al menos un canal
      if (notificadoExitosamente) {
        try {
          await supabase
            .from('licitaciones_notificadas')
            .insert([{ secop_id: lic.id_del_proceso }]);
        } catch (dbError) {
          console.error(`Error al registrar en Supabase:`, dbError.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      mensaje: 'Monitoreo y notificaciones ejecutados',
      totalEncontradasSocrata: licitaciones.length,
      totalNuevas: nuevasLicitaciones.length,
      mensajesWhatsAppEnviados: mensajesWhatsAppEnviados,
      mensajesTelegramEnviados: mensajesTelegramEnviados
    });

  } catch (error) {
    console.error('Error en el cron:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
