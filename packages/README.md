# GitMind Packages

Esta es la nueva arquitectura modular de GitMind, organizada en packages especializados.

## Estructura de Packages

### 🎯 Core (`@core`)
- **Container**: Sistema de inyección de dependencias
- **Config**: Gestión de configuración
- **Logger**: Sistema de logging
- **Bootstrap**: Inicialización de la aplicación

### 🔧 Git (`@git`)
- **Domain**: Interfaces para operaciones Git
- **Infrastructure**: Implementación con BunGitService

### 🤖 LLM (`@llm`)
- **Domain**: Interfaces para servicios de LLM
- **Application**: Casos de uso (SummarizeDiffsUseCase)
- **Infrastructure**: Implementación con OpenAI

### 📝 Commit (`@commit`)
- **Domain**: Modelos de planificación de commits
- **Application**: Casos de uso (PlanCommitsUseCase)

### 🐙 GitHub (`@github`)
- **Domain**: Interfaces para operaciones de GitHub
- **Infrastructure**: Implementación con GitHub API

### 💬 CLI Interaction (`@cli-interaction`)
- **Domain**: Interfaces para interacción con usuario
- **Infrastructure**: Implementación con Inquirer

### 📁 File Processing (`@file-processing`)
- **Domain**: Interfaces para procesamiento de archivos
- **Infrastructure**: Implementación de procesamiento de diffs

### 🔄 Workflow (`@workflow`)
- **Application**: Casos de uso de orquestación (CommitWorkflowUseCase)

## Beneficios de la Nueva Arquitectura

### ✅ Separación de Responsabilidades
Cada package tiene una responsabilidad específica y bien definida.

### 🔄 Reutilización
Los packages pueden ser utilizados por diferentes aplicaciones:
- CLI
- Extensiones de VS Code
- Aplicación web
- APIs

### 🧪 Testabilidad
Cada package puede ser testeado independientemente.

### 🛠️ Mantenibilidad
Cambios en un área no afectan otras partes del sistema.

### 📈 Escalabilidad
Fácil agregar nuevas funcionalidades sin afectar el código existente.

## Uso de los Packages

### En el CLI
```typescript
import { CommitWorkflowUseCase } from '@workflow/application/CommitWorkflowUseCase'

@Injectable()
export class Cli {
  constructor(
    @Inject(CommitWorkflowUseCase) private workflow: CommitWorkflowUseCase,
  ) {}

  async start() {
    await this.workflow.execute()
  }
}
```

### Inyección de Dependencias
El sistema de inyección de dependencias automáticamente resuelve las dependencias entre packages:

```typescript
@Injectable()
export class CommitWorkflowUseCase {
  constructor(
    @Inject(BunGitService) private git: BunGitService,
    @Inject(InquirerInteractionService) private interaction: InquirerInteractionService,
    @Inject(SummarizeDiffsUseCase) private summarizeDiffs: SummarizeDiffsUseCase,
    // ... otras dependencias
  ) {}
}
```

## Migración del Código Anterior

El código anterior del CLI (407 líneas) ha sido refactorizado en:

1. **GitHub Integration** → `@github` package
2. **CLI Interaction** → `@cli-interaction` package  
3. **File Processing** → `@file-processing` package
4. **Workflow Orchestration** → `@workflow` package

El CLI actual tiene solo **25 líneas** y se enfoca únicamente en la orquestación del flujo principal.

## Próximos Pasos

1. **Tests**: Agregar tests unitarios para cada package
2. **Documentación**: Documentar APIs de cada package
3. **Validación**: Validar que todas las funcionalidades funcionen correctamente
4. **Optimización**: Optimizar imports y dependencias 