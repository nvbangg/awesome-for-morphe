package me.jman.parser

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.io.File
import java.io.FileNotFoundException
import java.lang.reflect.InvocationTargetException
import java.lang.reflect.Method
import java.lang.reflect.Modifier
import java.net.URI
import java.net.URLClassLoader
import java.util.jar.JarFile

private const val MORPHE_PATCHER_CLASSPATH_PROPERTY = "morphe.patcher.classpath"

internal fun generateMorphePatchList(downloadUri: URI, expectedVersion: String? = null): PatchListResult? {
    val patchesFile = File.createTempFile("morphe-patches", ".mpp")
    return try {
        downloadToFile(downloadUri.toURL(), patchesFile)
        try {
            val bundleName = JarFile(patchesFile).use { it.manifest?.mainAttributes?.getValue("Name") }
            val classLoader = Thread.currentThread().contextClassLoader
            val patches = loadMorphePatchesFromJar(patchesFile, classLoader)
            val jsonPatches = patches.map(::convertMorphePatch)
            if (jsonPatches.isEmpty()) {
                Logger.warning("No patches were found in the Morphe patch bundle.")
                if (expectedVersion != null) {
                    Logger.info("Attempting fallback to repository patches-list.json...")
                    generateMorphePatchListFromSource(downloadUri, expectedVersion)
                } else null
            } else {
                PatchListResult(JsonArray(jsonPatches), bundleName)
            }
        } catch (e: Exception) {
            Logger.warning("Failed to parse Morphe patch bundle. ${e.describeForLog()}")
            if (expectedVersion != null) {
                Logger.info("Attempting fallback to repository patches-list.json for $downloadUri...")
                generateMorphePatchListFromSource(downloadUri, expectedVersion)
            } else {
                null
            }
        }
    } catch (_: FileNotFoundException) {
        Logger.warning("The patch bundle file was not found.")
        null
    } catch (e: Exception) {
        Logger.warning("Failed to download patch bundle. ${e.message}")
        null
    } finally {
        patchesFile.delete()
    }
}

private fun Throwable.describeForLog(): String {
    val chain = generateSequence(this) { it.cause }
        .take(5)
        .map { throwable ->
            val type = throwable::class.simpleName ?: throwable::class.java.name
            val message = throwable.message?.takeIf { it.isNotBlank() } ?: "no message"
            "$type: $message"
        }
        .toList()

    return if (chain.isEmpty()) {
        val type = this::class.simpleName ?: this::class.java.name
        "$type: no message"
    } else {
        chain.joinToString(" <- ")
    }
}

private fun morpheClasspathFiles(): List<File> {
    val classpathProperty = System.getProperty(MORPHE_PATCHER_CLASSPATH_PROPERTY)
        ?.takeIf { it.isNotBlank() }
        ?: throw IllegalStateException("Morphe patcher classpath is not configured.")

    val classpathFiles = classpathProperty
        .split(File.pathSeparator)
        .map { it.trim() }
        .filter { it.isNotEmpty() }
        .map(::File)
        .filter(File::exists)

    if (classpathFiles.isEmpty()) {
        throw IllegalStateException("Morphe patcher classpath is empty.")
    }

    return classpathFiles
}

private fun loadMorphePatchesFromJar(
    patchesFile: File,
    morpheClassLoader: ClassLoader
): List<Any> {
    val loadMethod = findMorpheLoadMethod(morpheClassLoader)
    val patches = try {
        loadMethod.invoke(null, setOf(patchesFile))
    } catch (e: InvocationTargetException) {
        val target = e.targetException ?: e
        val type = target::class.simpleName ?: target::class.java.name
        val message = target.message?.takeIf { it.isNotBlank() } ?: "no message"
        throw IllegalStateException(
            "Morphe patcher failed to load ${patchesFile.name}. $type: $message",
            target
        )
    } ?: throw IllegalStateException("Morphe patcher returned no patches for ${patchesFile.name}.")

    val loaded = when (patches) {
        is Iterable<*> -> patches.mapNotNull(::retainNamedPatch)
        is Array<*> -> patches.mapNotNull(::retainNamedPatch)
        else -> throw IllegalStateException("Unexpected Morphe patch result type: ${patches::class.java.name}")
    }

    if (loaded.isEmpty()) {
        throw IllegalStateException("No Morphe patch entries were discovered in ${patchesFile.name}.")
    }

    return loaded
}

private fun findMorpheLoadMethod(classLoader: ClassLoader): Method {
    val candidateClasses = morpheLoaderClasses(classLoader)

    return candidateClasses.asSequence()
        .flatMap { it.methods.asSequence() }
        .firstOrNull { method ->
            method.name == "loadPatchesFromJar" &&
                Modifier.isStatic(method.modifiers) &&
                method.parameterCount == 1
        }
        ?: throw NoSuchMethodException("loadPatchesFromJar(Set<File>) not found in Morphe patcher runtime.")
}

private fun morpheLoaderClasses(classLoader: ClassLoader): List<Class<*>> {
    val classpathFiles = morpheClasspathFiles()

    return classpathFiles.flatMap { jarFile ->
        if (!jarFile.extension.equals("jar", ignoreCase = true)) {
            return@flatMap emptyList()
        }

        JarFile(jarFile).use { jar ->
            jar.entries().toList()
                .filter { entry ->
                    entry.name.startsWith("app/morphe/patcher/patch/") &&
                        entry.name.endsWith(".class") &&
                        !entry.name.startsWith("META-INF/")
                }
                .mapNotNull { entry ->
                    val className = entry.name.substringBeforeLast('.').replace('/', '.')
                    try {
                        classLoader.loadClass(className)
                    } catch (_: Throwable) {
                        null
                    }
                }
        }
    }
}

private fun retainNamedPatch(candidate: Any?): Any? {
    candidate ?: return null
    return candidate.takeIf { dependencyLabel(it).isNotBlank() }
}

private fun convertMorphePatch(patch: Any): JsonObject {
    val name = readStringMember(patch, "name").orEmpty()
    val description = readStringMember(patch, "description").orEmpty()
    val default = readBooleanMember(patch, "default") ?: readBooleanMember(patch, "use") ?: true
    
    val dependencies = JsonArray(
        asIterable(readMemberValue(patch, "dependencies"))
            .mapNotNull(::retainNamedPatch)
            .map { JsonPrimitive(dependencyLabel(it)) }
    )
    
    val compatibilityList = readMemberValue(patch, "compatibility") as? List<*> ?: emptyList<Any?>()
    val compatiblePackages = if (compatibilityList.isNotEmpty()) {
        convertMorpheCompatibility(compatibilityList)
    } else {
        convertMorpheCompatiblePackages(
            readMemberValue(patch, "compatiblePackages") as? Set<*> ?: emptySet<Any?>()
        )
    }
    val optionsValue = readMemberValue(patch, "options")
    val options = JsonArray(
        when (optionsValue) {
            is Map<*, *> -> optionsValue.values
            else -> asIterable(optionsValue)
        }.mapNotNull(::convertMorpheOption)
    )

    return JsonObject(linkedMapOf(
        "name" to JsonPrimitive(name),
        "description" to JsonPrimitive(description),
        "default" to JsonPrimitive(default),
        "dependencies" to dependencies,
        "compatiblePackages" to compatiblePackages,
        "options" to options
    ))
}

private fun dependencyLabel(patch: Any): String {
    return readStringMember(patch, "name")?.takeIf { it.isNotBlank() }
        ?: patch.javaClass.simpleName.takeIf { it.isNotBlank() }
        ?: patch.javaClass.name
}

private fun convertMorpheOption(option: Any?): JsonObject? {
    option ?: return null

    val name = readStringMember(option, "name").orEmpty()
    val key = name.ifBlank { readStringMember(option, "key").orEmpty() }
    val title = readStringMember(option, "title").orEmpty().ifBlank { name.ifBlank { key } }
    val description = readStringMember(option, "description").orEmpty()
    val required = readBooleanMember(option, "required") ?: false
    val type = readMemberValue(option, "type")?.toString() ?: "kotlin.Any"
    val default = toJsonValue(readMemberValue(option, "default"))
    val values = readMemberValue(option, "values") as? Map<*, *> ?: emptyMap<String, Any?>()
    val valuesJson = if (values.isEmpty()) JsonNull else mapToJsonObject(values)

    return JsonObject(linkedMapOf(
        "key" to JsonPrimitive(key),
        "title" to JsonPrimitive(title),
        "description" to JsonPrimitive(description),
        "required" to JsonPrimitive(required),
        "type" to JsonPrimitive(type),
        "default" to default,
        "values" to valuesJson
    ))
}

private fun convertMorpheCompatibility(compatibilityList: List<*>): JsonElement {
    if (compatibilityList.isEmpty()) return JsonNull

    val packagesArray = JsonArrayBuilder()
    var ignoredCount = 0

    for (compatibility in compatibilityList) {
        if (compatibility == null) continue
        val packageName = readStringMember(compatibility, "packageName")
        if (packageName == null) {
            ignoredCount++
            continue
        }

        val name = readStringMember(compatibility, "name")
        val description = readStringMember(compatibility, "description")
        val apkFileType = readMemberValue(compatibility, "apkFileType")?.toString()?.substringAfterLast('.')
        val appIconColorInt = (readMemberValue(compatibility, "appIconColor") as? Number)?.toInt()
        val appIconColor = appIconColorInt?.let { String.format("#%06X", (0xFFFFFF and it)) }
        val signatures = readMemberValue(compatibility, "signatures") as? Iterable<*> ?: emptyList<Any?>()

        val targets = readMemberValue(compatibility, "targets") as? Iterable<*> ?: emptyList<Any?>()
        val versionsArray = JsonArrayBuilder()

        for (target in targets) {
            if (target == null) continue
            val version = readStringMember(target, "version")
            val versionCodes = readMemberValue(target, "versionCodes")
            val isExperimental = readBooleanMember(target, "isExperimental") ?: false
            val minSdk = (readMemberValue(target, "minSdk") as? Number)?.toInt()
            val targetDescription = readStringMember(target, "description")

            versionsArray.add(JsonObject(linkedMapOf(
                "version" to (version?.let(::JsonPrimitive) ?: JsonNull),
                "versionCodes" to (versionCodes?.let(::toJsonValue) ?: JsonNull),
                "isExperimental" to JsonPrimitive(isExperimental),
                "minSdk" to (minSdk?.let(::JsonPrimitive) ?: JsonNull),
                "description" to (targetDescription?.let(::JsonPrimitive) ?: JsonNull)
            )))
        }

        val signatureArray = JsonArrayBuilder()
        for (sig in signatures) {
            if (sig is String) signatureArray.add(JsonPrimitive(sig))
        }

        packagesArray.add(JsonObject(linkedMapOf(
            "packageName" to JsonPrimitive(packageName),
            "name" to (name?.let(::JsonPrimitive) ?: JsonNull),
            "description" to (description?.let(::JsonPrimitive) ?: JsonNull),
            "apkFileType" to (apkFileType?.let(::JsonPrimitive) ?: JsonNull),
            "appIconColor" to (appIconColor?.let(::JsonPrimitive) ?: JsonNull),
            "signatures" to signatureArray.build(),
            "targets" to versionsArray.build()
        )))
    }

    if (ignoredCount > 0) {
        Logger.warning("Skipped $ignoredCount compatibility entries without package names.")
    }

    val finalArray = packagesArray.build()
    if (finalArray.isEmpty()) return JsonNull

    return finalArray
}

private class JsonArrayBuilder {
    private val elements = mutableListOf<JsonElement>()
    fun add(element: JsonElement) { elements.add(element) }
    fun build(): JsonArray = JsonArray(elements)
}

private fun convertMorpheCompatiblePackages(compatiblePackages: Set<*>): JsonElement {
    if (compatiblePackages.isEmpty()) {
        return JsonNull
    }

    val mapped = linkedMapOf<String, List<JsonElement>>()
    var ignoredCount = 0

    for (entry in compatiblePackages) {
        when {
            entry is Map.Entry<*, *> -> {
                val name = entry.key as? String ?: continue
                mapped[name] = parseCompatibleVersions(entry.value)
            }
            entry is String -> mapped[entry] = emptyList()
            entry != null && entry.javaClass.name == "kotlin.Pair" -> {
                val name = readMemberValue(entry, "first") as? String ?: continue
                mapped[name] = parseCompatibleVersions(readMemberValue(entry, "second"))
            }
            else -> ignoredCount++
        }
    }

    if (ignoredCount > 0) {
        Logger.warning("Skipped $ignoredCount compatible package entries with unsupported types.")
    }

    if (mapped.isEmpty()) {
        return JsonNull
    }

    return JsonObject(
        mapped.mapValues { (_, versions) -> JsonArray(versions) }
    )
}

private fun parseCompatibleVersions(value: Any?): List<JsonElement> {
    val items: List<Any> = when (value) {
        is String -> return listOfNotNull(value.trim().takeIf(String::isNotBlank)?.let(::JsonPrimitive))
        is Iterable<*> -> value.filterNotNull()
        is Array<*> -> value.filterNotNull()
        else -> return emptyList()
    }
    return items.mapNotNull { item ->
        if (item is String) {
            val trimmed = item.trim()
            if (trimmed.isNotBlank()) JsonPrimitive(trimmed) else null
        } else {
            val version = readStringMember(item, "version")
            val versionCodes = readMemberValue(item, "versionCodes")
            val isExperimental = readBooleanMember(item, "isExperimental") ?: readBooleanMember(item, "experimental") ?: false
            val minSdk = (readMemberValue(item, "minSdk") as? Number)?.toInt()
            val description = readStringMember(item, "description")
            
            if (version == null && versionCodes == null && !isExperimental && minSdk == null && description == null) {
                val fallback = item.toString().trim()
                if (fallback.isNotBlank()) JsonPrimitive(fallback) else null
            } else {
                JsonObject(linkedMapOf(
                    "version" to (version?.let(::JsonPrimitive) ?: JsonNull),
                    "versionCodes" to (versionCodes?.let(::toJsonValue) ?: JsonNull),
                    "isExperimental" to JsonPrimitive(isExperimental),
                    "minSdk" to (minSdk?.let(::JsonPrimitive) ?: JsonNull),
                    "description" to (description?.let(::JsonPrimitive) ?: JsonNull)
                ))
            }
        }
    }
}

private fun toJsonValue(value: Any?): JsonElement {
    return when (value) {
        null -> JsonNull
        is String -> JsonPrimitive(value)
        is Number -> JsonPrimitive(value)
        is Boolean -> JsonPrimitive(value)
        else -> JsonPrimitive(value.toString())
    }
}

private fun mapToJsonObject(values: Map<*, *>): JsonObject {
    val mapped = values.entries.mapNotNull { (rawKey, rawValue) ->
        val key = rawKey?.toString()?.takeIf(String::isNotBlank) ?: return@mapNotNull null
        key to toJsonValue(rawValue)
    }.toMap()
    return JsonObject(mapped)
}

private fun asIterable(value: Any?): List<Any> {
    return when (value) {
        is Iterable<*> -> value.filterNotNull()
        is Array<*> -> value.filterNotNull()
        null -> emptyList()
        else -> emptyList()
    }
}

private fun readStringMember(target: Any, vararg names: String): String? {
    return readMemberValue(target, *names)?.toString()
}

private fun readBooleanMember(target: Any, vararg names: String): Boolean? {
    return when (val value = readMemberValue(target, *names)) {
        is Boolean -> value
        is String -> value.toBooleanStrictOrNull()
        else -> null
    }
}

private fun readMemberValue(target: Any, vararg names: String): Any? {
    for (name in names) {
        findAccessor(target.javaClass, name)?.let { accessor ->
            try {
                return accessor.invoke(target)
            } catch (_: Throwable) {
                // Try the next accessor candidate.
            }
        }

        target.javaClass.fields.firstOrNull { it.name == name }?.let { field ->
            try {
                return field.get(target)
            } catch (_: Throwable) {
                // Try the next accessor candidate.
            }
        }
    }

    return null
}

private fun findAccessor(type: Class<*>, name: String): Method? {
    val capitalized = name.replaceFirstChar { it.uppercaseChar() }
    val candidates = listOf(name, "get$capitalized", "is$capitalized")

    return type.methods.firstOrNull { method ->
        method.parameterCount == 0 && method.name in candidates
    }
}
