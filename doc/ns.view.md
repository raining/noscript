# ns.View

Вид представляет собой элемент интерфейса.
Он однозначно идентифицируется своим ключом, который строится во время инициализации исходя из [параметров вида](#Параметры).
Разный ключ всегда означает разный экземпляр вида.

Не стоит ожидать, что при изменении параметров будет перерисован тот же самый вид.
Этого можно достичь, но в общем виде будет создан и отрисован новый экземпляр.

Ключ очень важен для работы `ns.Box`.
`ns.Box` при каждом обновлении высчитывает ключи для видов, которые должен показать, скрывает все виды, у которых ключ не совпадает и показывает те, которые надо.

## Декларация

Определение нового вида происходит через статическую функцию `ns.View.define`
```js
ns.View.define('viewName', viewDeclObject[, baseView])
```

Объект-декларация состоит из следующих свойств.

### ctor

`ctor` - это функция-конструтор. Обратите внимание, что он вызывается самым первым, до инициализации самого вида, т.о. в конструкторе еще не доступеы некоторые свойства.

Полностью готовый экземпляр бросает событие `ns-view-init`.

```
/**
 * @classdesc prj.vMyView
 * @augments ns.View
 */
ns.View.define('my-view', {
    /**
     * @constructs prj.vMyView
     */
    ctor: function() {
        this._state = 'initial';
        this.CONST = 100;
    }
});
```

### `events`

`events` - объект с декларацией подписок на события, как DOM, так и noscript.

Любая подписка имеет вид:
```json
{
    "на что подписаться@когда": "обработчик"
}
```
Обработчиков может быть названием метода из прототипа или функция. Все обработчики вызываются в контексте вида.

События с суффиксом `@show` вешаются во время показа вида (событие `ns-view-show`) и снимаются во время скрытия (событие `ns-view-hide`).
Аналогично, суффикс `@init` означает, что событие будет активировано на `ns-view-htmlinit` и деактивировано на `ns-view-htmldestroy`.

#### DOM-события

DOM-события от события noscript различаются согласно массиву `ns.V.DOM_EVENTS`. Все, что не входит в этот массив, является "космическим" событием noscript.

DOM-события навешиваются через механизм делегирования.

Примеры деклараций:
```js
{
    // событие click на корневой ноде вида
    "click": "onClick",

    // событие click на нодах к классом selector внутри вида
    "click .selector": "onSelectorClick",

    // событие click на нодах к классом selector внутри вида,
    // из-за @init обработчик навешивается на ns-view-htmlinit и снимается при ns-view-htmldestroy
    "click@init .selector": "onInitSelectorClick",

    // обработчик события scroll на window
    "scroll window": 'onScroll'
}
```

Правила для DOM-событий:

 1. Все (кроме `scroll`) события работают через механизм [event delegation](http://www.nczonline.net/blog/2009/06/30/event-delegation-in-javascript/).
 2. По умолчанию все обработчики навешиваются на `ns-view-show` и снимаются на `ns-view-hide`
 2. Событие `scroll` не всплывает, поэтому навешивается напрямую на ноду, указанную в селекторе.
 3. В качестве селектора можно указать `window` или `document`, в этом случае событие будет навешано на соответствующий глобальный объект.

#### "Космические" события noscript

Декларируются как и остальные события
```js
{
    "my-custom-event": "onCustomEvent",
    "my-custom-init@init": "onCustomInit"
}
```

Если не указано когда вешать обработчик, то оно будет навешан при показе вида и снят при скрытии.

"Косимческие" события работают через единую шину `ns.events`
```js
ns.events.trigger('my-custom-event');
```

#### Встроенные события

Список событий:

* `ns-view-hide` - вида сейчас виден на странице и будет скрыт. Нода вида находится в DOM.
* `ns-view-htmldestroy` - вид сейчас виден на странице, но его нода будет заменена на новую. Нода вида находится в DOM.
* `ns-view-htmlinit` - у вида появилась новая нода, при этом не гарантируется, что она находится в DOM.
* `ns-view-async` - у async-view появилась заглушка. Это единственное событие, которое генерируется для заглушки async-view
* `ns-view-show` - view был показан и теперь виден на странице. Нода вида находится в DOM.
* `ns-view-touch` - view виден и был затронут в процессе обновления страницы. Нода вида находится в DOM.

Правила:

1. События генерируются снизу вверх, т.е. сначала их получают дочерние вида, потом родительские.
2. События генерируются пачками, т.е. сначала одно событие у всех view, потом другое событие у всех view.
3. События генерируются в строго определенном порядке, указанном выше

Примеры последовательностей событий:

* инициализация view: ```ns-view-htmlinit -> ns-view-show -> ns-view-touch```
* перерисовка страница, если view валиден: ```ns-view-touch```
* view был скрыт: ```ns-view-hide``` (без ```ns-view-touch```)
* view был показан: ```ns-view-show -> ns-view-touch```
* view был перерисован: ```ns-view-hide -> ns-view-htmldestroy -> ns-view-htmlinit -> ns-view-show -> ns-view-touch``` (```ns-view-hide``` тут вызывается из тех соображений, что могут быть обработчики, которые вешаются на ```ns-view-show/ns-view-hide``` и при обновлении ноды, они должны быть переинициализированы)

### methods

`methods` - объект с методами вида. По сути является прототипом объекта.

```
/**
 * @classdesc prj.vMyView
 * @augments ns.View
 */
ns.View.define('my-view', {
    /** @lends prj.vMyView.prototype */
    methods: {
        BAR: 100
        foo: function(){}
    }
});
```

### models

`models` позволяет указать модели, от которых зависит вид. Зависимость означает, что

 1. параметры вида будут собраны на основе параметров связанных моделей
 2. в шаблонах вида будут доступны данные связанных моделей
 3. некоторые методы вида будут подписаны на события связанных моделей

По умолчанию вид подписывается на следующие стандартные события модели:

 - `ns-model-changed`
 - `ns-model-insert`
 - `ns-model-remove`
 - `ns-model-destroyed`

и не подписывается на событие `ns-model-touched`.

Если обработчики явно не указаны, то в качестве обработчика стандартных событий устанавливается метод `invalidate`.

```js
ns.View.define('super-view', {
  models: ['album', 'photo']
});
```

В приведённом примере вид будет инвалидироваться при любом стандартном событии модели.

Инвалидировать вид можно так же по любым другим событиям модели. Для этого в декларации нужно явно указать событие и обработчик.

```js
ns.View.define('super-view', {
  models: {
    album: {
      'ns-model-boof': 'invalidate'
    }
  }
});
```

Для того, чтобы предотвратить инвалидацию вида по конекретному событию, в качестве обработчика нужно явно указать метод `keepValid`.

```js
ns.View.define('super-view', {
  models: {
    album: {
      'ns-model-changed': 'keepValid'
    }
  }
});
```

В приведённом примере при наступлении события ns-model-changed вид будет оставаться валидным и не будет перерисован при последующих update'ах. При любом другом стандартном событии модели он будет проинвалидирован.

Для того, чтобы предотвратить инвалидацию вида по любому событию, `keepValid` нужно установить значением поля модели.


```js
ns.View.define('super-view', {
  models: {album: 'keepValid'}
});
```

В приведённом примере события модели `album` не будут влиять на валидность вида.

`'invalidate' и 'keepValid'` - это имена реальных методов. Вместо них можно указать имя любого другого метода вида.

Если нужно в качестве обработчика события использовать произвольный метод, и при этом инвалидировать вид, достаточно внутри метода вызвать `this.invalidate();`.

Для краткости вместо методов `invalidate` и `keepValid` можно указывать их краткую форму: `true` и `false` соответственно. 2 варианта деклараций в следующем примере работают одинаково.

Пример использования произвольных обработчиков:


```js
ns.View.define('supre-view', {
  models: {
    album: {
      'ns-model-changed': 'methodOfView'
    }
  },
  methods: {
    'methodOfView': function(){ }
  }
});
```

```js
ns.View.define('supre-view', {
  models: {
    album: {
      'ns-model-changed': function() { }
    }
  }
});
```

```js
ns.View.define('super-view', {
  models: {
    photo: 'invalidate',
    album: 'keepValid'
  }
});

ns.View.define('super-view', {
  models: {
    photo: true,
    album: false
  }
});
```

Для большей краткости зависимости от моделей можно указывать в виде массива. Это будет эквивалентно указанию в качестве обработчика их событий метода `invalidate`.

```js
ns.View.define('super-view', {
  models: ['photo', 'album']
});
```


### Параметры

Параметры нужны для построения ключа.

По умолчанию, если `params` не указан, то параметры собираются из параметров всех моделей в порядке их объявления.
Добавлять или удалять из собранных параметров моделей можно с помощью объектов `params+` и `params-`

Если `params` явно заданы — нельзя использовать `params+` / `params-`.

Если ключ view нельзя построить бросается **исключение**.

#### params+
Добавляет в результирующий набор дополнительные параметры:
```js
ns.View.define('super-view', {
  "models": [ 'album', 'photo' ],
  "params+": { page: 23 }
});
```

#### params-
Удаляет из результирующего набора указанные параметры:
```js
ns.View.define('super-view', {
  "models": [ 'album', 'photo' ],
  "params-": [ 'album-id' ]
});
```

#### params

`params` может быть массивом объектов или функцией.
Также можно указать объект - это короткая запись массива с одним элементом.

Каждый объект представляет собой группу параметров.
Это позволяет строить ключ по-разному в зависимости от набора.
```js
ns.View.define('super-view', {
  params: [
    { "context": "album", "album-id": null },
    { "context": null }
  ]
});
```

Как строится ключ:

- каждое свойство объекта — это обязательный параметр
- если значение свойства `null` — параметр обязателен, но значение его может быть любым
- если значение свойства не `null` — это **фильтр**, параметр из урла должен иметь именно это значение
- если есть все нужные параметры и выполняются все фильтры — ключ можно строить
- иначе — пытаемся строить по следующей группе параметров

Т.о. при использовании `params` все параметры являются обязательными.
Чтобы сделать их необязательными, используйте `params+`.

Если указана функция, то функция должна вернуть объект с параметрами, по которым будет построен ключ.
```js
ns.View.define('view', {
  // ns.key - готовая функция для склеивания параметров в строку
  params: ns.key
})
```

### paramsRewrite

`paramsRewrite` - функция в декларации, изменяющая параметры после их создания стандартными способами.
Она вызывается всегда и ее стоит использовать для динамического изменения параметров перед созданием вида.
 
```
ns.View.define('myView', {
    "models": [ 'album', 'photo' ],
    "paramsRewrite": function(params) {
        if (someConditions) {
            params.newParam = 1;
        }

        return params;
    }
});
```

## Валидность

Валидность view считается по двум факторам:

- собственный статус `ns.V.STATUS`
- статус привязанных моделей

При отрисовке вид запоминает все версии моделей и в дальшейшем сравнимает их. Если версия изменилась, то вид будет перерисован.

Также у вида есть собственный статус `this.static`, значением которого может быть тип ns.V.STATUS. Если статус не `ns.V.STATUS.OK`, то вид будет перерисован.

Инвалидировать вид можно методом `this.invalidate()`.

Вид безусловно подписывается на все изменения моделей и автоматически инвалидирует себя при изменениях.

## Взаимодействие

В noscript нет какого-либо способа получить созданный экземпляр вида.
Поэтому любое внешнее взаимодействие с ним осуществляется исключительно через механизм [событий noscript](#События-noscript)

## async

Вид может быть "асинхронным". Такое поведение полезно, когда некоторые модели могут запрашиваться с сервера продолжительное время.

Схема работы:

 1. Если у вида есть все необходимые данные (все модели валидны) для отрисовки, то он отрисуется в общем потоке.
 2. Если модели не валидны, то сначала отрисуется заглушка - мода `ns-view-async-content`, где будут доступны все валидные на данный момент данные, и сделан запрос за остальными моделями. У вида будет вызвано событие `ns-view-async`.
 3. После получения данных вид будет перерисован с обычной модой `ns-view-content` и поведет себя как обычно
