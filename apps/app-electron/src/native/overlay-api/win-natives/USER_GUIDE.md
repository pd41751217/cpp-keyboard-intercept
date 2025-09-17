# Game Overlay - Guía de Usuario

Esta guía proporciona instrucciones paso a paso para instalar, configurar y utilizar el Game Overlay en tus juegos favoritos.

## Índice

1. [Introducción](#introducción)
2. [Requisitos del Sistema](#requisitos-del-sistema)
3. [Instalación](#instalación)
4. [Uso Básico](#uso-básico)
5. [Configuración](#configuración)
6. [Solución de Problemas](#solución-de-problemas)
7. [Preguntas Frecuentes](#preguntas-frecuentes)

## Introducción

Game Overlay es una herramienta que te permite mostrar elementos de interfaz personalizados sobre tus juegos DirectX. Puedes utilizarlo para mostrar información adicional, chats, navegadores web, o cualquier otra funcionalidad mientras juegas sin tener que alternar entre aplicaciones.

### Características Principales

- Compatible con juegos que utilizan DirectX 9, 10, 11 y 12
- Soporte para múltiples ventanas de overlay
- Teclas de acceso rápido personalizables
- Mínimo impacto en el rendimiento
- Contador de FPS integrado

## Requisitos del Sistema

### Mínimos:
- Sistema Operativo: Windows 7 SP1 o superior (Windows 10/11 recomendado)
- Procesador: Dual-core 2.0 GHz o superior
- Memoria: 4 GB RAM
- DirectX: Versión 9.0c o superior
- Derechos de administrador para la instalación inicial

### Recomendados:
- Sistema Operativo: Windows 10/11 (última versión)
- Procesador: Quad-core 3.0 GHz o superior
- Memoria: 8 GB RAM o más
- DirectX: Versión 11 o superior

## Instalación

### Instalación Estándar

1. Descarga el último instalador desde [nuestra página web](https://example.com/game-overlay/download)
2. Ejecuta el instalador con derechos de administrador
3. Sigue las instrucciones en pantalla
4. Reinicia tu computadora cuando la instalación se complete

### Instalación Manual

Si prefieres una instalación manual:

1. Descarga el archivo ZIP desde [nuestra página de descargas](https://example.com/game-overlay/download)
2. Extrae el contenido en una carpeta de tu elección (por ejemplo, `C:\Programas\GameOverlay`)
3. Ejecuta `setup.exe` con derechos de administrador para registrar los componentes necesarios
4. Crea un acceso directo al ejecutable principal si lo deseas

## Uso Básico

### Iniciar el Overlay

1. Inicia el programa Game Overlay desde el menú de inicio o el acceso directo creado
2. El programa se ejecutará en segundo plano (podrás ver un icono en la bandeja del sistema)
3. Inicia tu juego

### Controles Predeterminados

- **Shift + Tab**: Mostrar/ocultar la ventana principal del overlay
- **Ctrl + F8**: Mostrar/ocultar el contador de FPS
- **Ctrl + F9**: Abrir la configuración del overlay

### Interactuar con las Ventanas del Overlay

- **Arrastrar desde la barra de título**: Mover una ventana del overlay
- **Arrastrar desde los bordes**: Cambiar el tamaño de una ventana
- **Clic derecho en la barra de título**: Menú contextual con opciones adicionales

## Configuración

### Configuración General

1. Abre la ventana de configuración con **Ctrl + F9** o haciendo clic derecho en el icono de la bandeja del sistema
2. En la pestaña "General", puedes:
   - Activar/desactivar el inicio automático con Windows
   - Cambiar el idioma de la interfaz
   - Configurar la transparencia de las ventanas
   - Activar/desactivar notificaciones

### Personalización de Teclas

1. En la ventana de configuración, selecciona la pestaña "Teclas"
2. Haz clic en la tecla que deseas modificar
3. Presiona la nueva combinación de teclas que deseas utilizar
4. Haz clic en "Guardar"

### Configuración por Juego

Puedes tener configuraciones específicas para cada juego:

1. En la ventana de configuración, selecciona la pestaña "Juegos"
2. Haz clic en "Añadir" para agregar un nuevo juego
3. Selecciona el ejecutable del juego
4. Configura las opciones específicas para ese juego:
   - Activar/desactivar automáticamente el overlay
   - Configurar teclas específicas
   - Definir posiciones de ventanas

### Configuración Avanzada

Para usuarios avanzados, hay opciones adicionales disponibles:

1. En la ventana de configuración, selecciona la pestaña "Avanzado"
2. Aquí puedes:
   - Configurar opciones de renderizado
   - Ajustar prioridades de procesos
   - Configurar opciones de depuración
   - Gestionar la compatibilidad con anti-cheat

## Solución de Problemas

### El Overlay No Aparece en el Juego

1. Verifica que el juego utiliza DirectX 9, 10, 11 o 12
2. Asegúrate de que el programa Game Overlay está en ejecución
3. Intenta presionar la tecla de acceso rápido (por defecto Shift + Tab)
4. Verifica que no haya otro software de overlay interfiriendo (Steam, Discord, etc.)
5. Reinicia el juego y el programa Game Overlay
6. Ejecuta tanto el juego como Game Overlay como administrador

### Bajo Rendimiento con el Overlay Activado

1. Reduce el número de ventanas de overlay activas
2. Desactiva efectos de transparencia
3. Verifica si otros programas están consumiendo recursos
4. Actualiza tus controladores de gráficos
5. En la configuración avanzada, ajusta las opciones de rendimiento

### Problemas con Anti-Cheat

Algunos juegos con sistemas anti-cheat estrictos pueden detectar el Game Overlay como software no autorizado. En estos casos:

1. Desactiva el overlay para ese juego específico
2. Verifica si hay un modo de compatibilidad específico para ese juego en la configuración
3. Consulta nuestra lista de compatibilidad en el sitio web para ver si hay soluciones específicas

### Problemas de Estabilidad

Si experimentas cierres inesperados:

1. Verifica que tienes la última versión del Game Overlay
2. Actualiza tus controladores de gráficos
3. Comprueba los registros de errores en: `%AppData%\GameOverlay\logs\`
4. Reinicia tu computadora
5. Considera una reinstalación limpia del software

## Preguntas Frecuentes

### ¿Es seguro usar Game Overlay en juegos online?

La mayoría de los juegos permiten el uso de overlays, pero algunos juegos con sistemas anti-cheat estrictos pueden detectarlo como software no autorizado. Consulta nuestra lista de compatibilidad o comunícate con el soporte del juego si tienes dudas.

### ¿Puedo usar Game Overlay con juegos en modo ventana?

Sí, Game Overlay funciona tanto en juegos en pantalla completa como en modo ventana.

### ¿El overlay afecta el rendimiento del juego?

El impacto en el rendimiento es mínimo en la mayoría de los casos, especialmente cuando las ventanas del overlay están ocultas. Si notas una caída significativa de FPS, consulta la sección de solución de problemas.

### ¿Cómo puedo crear mis propias aplicaciones para el overlay?

Para desarrolladores interesados en crear aplicaciones para Game Overlay, consulta nuestra documentación para desarrolladores en [nuestra página web](https://example.com/game-overlay/developers).

### ¿Qué hago si un juego se actualiza y el overlay deja de funcionar?

Las actualizaciones de juegos pueden a veces afectar la compatibilidad. En estos casos:
1. Verifica si hay una actualización disponible para Game Overlay
2. Reinicia el juego y el programa Game Overlay
3. Reporta el problema en nuestro foro de soporte

### ¿Cómo desinstalo completamente Game Overlay?

1. Usa el desinstalador desde Panel de Control > Programas y Características
2. Alternativamente, ejecuta el desinstalador en la carpeta de instalación
3. Para una limpieza completa, elimina manualmente cualquier archivo residual en `%AppData%\GameOverlay\`

---

Si necesitas ayuda adicional, visita nuestro [foro de soporte](https://example.com/game-overlay/support) o contacta con nuestro equipo de soporte en support@gameoverlay.example.com. 