import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializar cliente de Supabase con las variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
                  `upper(descripci_n_del_procedimiento) like '%CARPA%')`;
                  
    const query = new URLSearchParams({
      '$where': where,
      '$order': 'fecha_de_publicacion_del DESC',
      '$limit': '5' // Procesaremos de a 5 para no saturar pruebas
    });

    const url = `https://www.datos.gov.co/resource/p6dx-8zbt.json?${query.toString()}`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error('Error al consultar Socrata');
    const licitaciones = await response.json();
    
    let nuevasLicitaciones = [];

    // 2. Filtrar las que ya existen en Supabase (Deduplicación)
    for (const lic of licitaciones) {
      const id = lic.id_del_proceso;
      
      // Consultar si este ID ya existe en nuestra tabla
      const { data, error } = await supabase
        .from('licitaciones_notificadas')
        .select('secop_id')
        .eq('secop_id', id)
        .single(); // Intenta traer 1 solo registro

      // Si no hay datos (la query no encontró el ID), entonces es NUEVA
      if (!data) {
        nuevasLicitaciones.push(lic);
        
        // Inmediatamente la guardamos en BD para que en la próxima ejecución ya figure como "notificada"
        await supabase
          .from('licitaciones_notificadas')
          .insert([{ secop_id: id }]);
      }
    }

    // 3. (PRÓXIMO PASO) Enviar alertas por Twilio
    // Aquí agregaremos luego el código para enviar el WhatsApp por cada licitación en "nuevasLicitaciones"

    return NextResponse.json({
      success: true,
      mensaje: 'Monitoreo ejecutado correctamente',
      totalEncontradasSocrata: licitaciones.length,
      totalNuevas: nuevasLicitaciones.length,
      nuevas: nuevasLicitaciones.map(l => ({
        id: l.id_del_proceso,
        entidad: l.entidad,
        presupuesto: l.precio_base
      }))
    });

  } catch (error) {
    console.error('Error en el cron:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
