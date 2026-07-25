package me.jman.parser

object Logger {
    private val context = ThreadLocal<String>()
    fun setContext(name: String?) {
        if (name == null) context.remove() else context.set(name)
    }
    private fun prefix(msg: String): String {
        val ctx = context.get()
        return if (ctx != null) "[$ctx] $msg" else msg
    }
    fun info(message: String) = println(message)

    fun warning(message: String) = println("::warning::${prefix(message)}")

    fun error(message: String) = println("::error::${prefix(message)}")
}
