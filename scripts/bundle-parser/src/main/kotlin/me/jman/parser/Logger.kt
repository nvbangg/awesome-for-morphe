package me.jman.parser

object Logger {
    private val context = ThreadLocal<String>()
    fun setContext(name: String?) {
        if (name == null) context.remove() else context.set(name)
    }
    private fun prefix(message: String): String {
        val contextValue = context.get()
        return if (contextValue != null) "[$contextValue] $message" else message
    }
    fun info(message: String) = println(message)

    fun warning(message: String) = println("::warning::${prefix(message)}")

    fun error(message: String) = println("::error::${prefix(message)}")
}
