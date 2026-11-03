# PulseLab

PulseLab es un sistema web de simulación clínica para estudiantes de enfermería. Permite que un docente cree casos clínicos, configure signos vitales, agregue preguntas de opción múltiple y revise los resultados obtenidos por los alumnos. El alumno puede iniciar sesión con Google, resolver casos publicados, consultar un monitor de signos vitales 2D/3D y recibir retroalimentación al finalizar.

## Prototipo del sistema

El prototipo funcional corresponde a la aplicación real desplegada en Firebase Hosting:

https://virtual-beat-91e9e.web.app

La aplicación cubre los flujos principales solicitados en el proyecto:

- Inicio de sesión con Google.
- Acceso diferenciado para docente y alumno.
- Banco de casos clínicos.
- Creación, edición, publicación y eliminación de casos.
- Resolución de casos por parte del alumno.
- Monitor de signos vitales en modo 2D y 3D.
- Uso de temporizador y comodín 50/50.
- Retroalimentación por respuesta.
- Registro de resultados.
- Reportes para el docente.
- Gestión de estudiantes y docentes.

## Estructura del repositorio

```txt
/
├─ src/                 Código fuente de la aplicación PulseLab
├─ public/              Recursos públicos, favicon y logotipo
├─ prototipo/           Referencia del prototipo funcional desplegado
├─ documentacion/       Especificación final, matrices y rúbrica
├─ diagramas/           Diagramas del proyecto y modelo de datos
├─ minutas/             Minutas de entrevista y validación
├─ firebase.json        Configuración de Firebase Hosting
├─ firestore.rules      Reglas de seguridad de Firestore
├─ package.json         Dependencias y comandos del proyecto
└─ README.md            Mapa de navegación del repositorio
```

## Documentación incluida

- `documentacion/Especificacion_Final_Proyecto.docx`
- `documentacion/Matriz_Requerimientos.xlsx`
- `documentacion/Matriz_Trazabilidad.xlsx`
- `documentacion/Rubrica_Evaluacion_Final.docx`
- `minutas/Minuta_Entrevista_Inicial.docx`
- `minutas/Minutas_Entrevistas.pdf`
- `minutas/Minuta_Validacion_Prototipo.docx`
- `diagramas/AS_IS.jpg`
- `diagramas/Diagrama_AS-IS.pdf`
- `diagramas/TO-BE.jpg`
- `diagramas/Diagrama_TO-BE.pdf`
- `diagramas/Diagrama_ER.png`
- `diagramas/Diagrama_ER.mwb`
- `diagramas/Diagrama_ER.mwb.zip`

## Tecnologías utilizadas

- React
- Vite
- Tailwind CSS
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting
- Three.js
- Cliente de datos
- Codex
- Claude

## Ejecutar localmente

Para ejecutar el proyecto en una computadora local:

```bash
npm install
npm run dev
```

Después se abre la URL local que indique Vite, normalmente:

```txt
http://localhost:5173
```

## Variables de entorno

El proyecto utiliza Firebase. Por seguridad, el archivo `.env` no se incluye en el repositorio. Se deja un archivo `.env.example` como referencia para configurar las variables necesarias.

## Despliegue

Para generar la versión de producción y publicarla en Firebase Hosting:

```bash
npm run deploy
```

## Derechos de autor

© 2026 PulseLab. Proyecto académico desarrollado para la materia de Ingeniería de Requerimientos. Todos los derechos reservados.
