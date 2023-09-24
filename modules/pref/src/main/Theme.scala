package lila.pref

final class Theme private[pref] (val name: String, val file: String):

  override def toString = name

  def cssClass = name

sealed trait ThemeObject:

  val all: List[Theme]
  val default: Theme

  lazy val allByName = all.mapBy(_.name)

  def apply(name: String): Theme         = allByName.getOrElse(name, default)
  def apply(name: Option[String]): Theme = name.fold(default)(apply)

  def contains(name: String) = allByName contains name

object Theme extends ThemeObject:

  val all = List(
    new Theme("brown", "svg/brown.svg"),
    new Theme("wood", "wood.jpg"),
    new Theme("wood2", "wood2.jpg"),
    new Theme("wood3", "wood3.jpg"),
    new Theme("wood4", "wood4.jpg"),
    new Theme("maple", "maple.jpg"),
    new Theme("maple2", "maple2.jpg"),
    new Theme("wood-worn", "wood-worn.webp"),
    new Theme("blue", "svg/blue.svg"),
    new Theme("blue2", "blue2.jpg"),
    new Theme("blue3", "blue3.jpg"),
    new Theme("blue-haze", "blue-haze.webp"),
    new Theme("canvas", "canvas2.jpg"),
    new Theme("blue-marble", "blue-marble.jpg"),
    new Theme("pool", "pool.webp"),
    new Theme("green", "svg/green.svg"),
    new Theme("marble", "marble.jpg"),
    new Theme("green-plastic", "green-plastic.png"),
    new Theme("putt-putt", "putt-putt.webp"),
    new Theme("olive", "olive.jpg"),
    new Theme("grey", "grey.jpg"),
    new Theme("metal", "metal.jpg"),
    new Theme("newspaper", "newspaper.png"),
    new Theme("purple", "svg/purple.svg"),
    new Theme("purple-diag", "purple-diag.png"),
    new Theme("pink", "pink-pyramid.png"),
    new Theme("venus", "venus.webp"),
    new Theme("pigskin", "pigskin.webp"),
    new Theme("horsey", "horsey.jpg"),
    new Theme("parchment", "parchment.webp"),
    new Theme("cocoa", "cocoa.webp"),
    new Theme("leather", "leather.jpg"),
    new Theme("ic", "svg/ic.svg")
  )

  val default = allByName get "brown" err "Can't find default theme D:"

object Theme3d extends ThemeObject:

  val all = List(
    new Theme("Black-White-Aluminium", "Black-White-Aluminium.png"),
    new Theme("Brushed-Aluminium", "Brushed-Aluminium.png"),
    new Theme("China-Blue", "China-Blue.png"),
    new Theme("China-Green", "China-Green.png"),
    new Theme("China-Grey", "China-Grey.png"),
    new Theme("China-Scarlet", "China-Scarlet.png"),
    new Theme("China-Yellow", "China-Yellow.png"),
    new Theme("Classic-Blue", "Classic-Blue.png"),
    new Theme("Gold-Silver", "Gold-Silver.png"),
    new Theme("Green-Glass", "Green-Glass.png"),
    new Theme("Light-Wood", "Light-Wood.png"),
    new Theme("Power-Coated", "Power-Coated.png"),
    new Theme("Purple-Black", "Purple-Black.png"),
    new Theme("Rosewood", "Rosewood.png"),
    new Theme("Wood-Glass", "Wood-Glass.png"),
    new Theme("Marble", "Marble.png"),
    new Theme("Wax", "Wax.png"),
    new Theme("Jade", "Jade.png"),
    new Theme("Woodi", "Woodi.png")
  )

  val default = allByName get "Woodi" err "Can't find default theme D:"
