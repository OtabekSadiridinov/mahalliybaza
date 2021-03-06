import isSubset from '../../utils/isSubset'
import logger from "../../utils/logger"
import selectionLevel from '../../api-utils/selectionLevel'
import success from '../../api-utils/success'
import error from '../../api-utils/error'
import showUserErrors from '../../api-utils/showUserErrors'

export default function deleteIt() {

  return new Promise((resolve, reject) => {

    // delete database
    this.deleteDatabase = () => {
      let dbName = this.dbName

      indexedDB.deleteDatabase(dbName)
      resolve(
        success.call(
          this,
          `"${ dbName }" nomli ma'lumotlar bazasi o'chirildi.`,
          { database: dbName }
        )
      )
    }

    // delete collection
    this.deleteCollection = () => {
      let dbName = this.dbName
      let collectionName = this.collectionName

      // we can only delete one collection at a time, which is why we need a queue

      this.addToDeleteCollectionQueue = (collectionName) => {
        this.deleteCollectionQueue.queue.push(collectionName)
        this.runDeleteCollectionQueue()
      }

      this.runDeleteCollectionQueue = () => {
        if (this.deleteCollectionQueue.running == false) {
          this.deleteCollectionQueue.running = true
          this.deleteNextCollectionFromQueue()
        }
      }

      this.deleteNextCollectionFromQueue = () => {
        if (this.deleteCollectionQueue.queue.length) {
          let collectionToDelete = this.deleteCollectionQueue.queue[0]
          this.deleteCollectionQueue.queue.shift()

          this.lf[collectionToDelete].dropInstance({
            name        : dbName,
            storeName   : collectionToDelete
          }).then(() => {
            this.deleteNextCollectionFromQueue()
            resolve(
              success.call(
                this,
                `"${ collectionToDelete }" nomli collection o'chirildi.`,
                { collection: collectionToDelete }
              )
            )
          }).catch(error => {
            reject(
              error.call(
                this,
                `"${ collectionToDelete }" nomli collection o'chirilmadi.`
              )
            )
          })
        }
        else {
          this.deleteCollectionQueue.running = false
        }
      }

      this.addToDeleteCollectionQueue(collectionName)
    }

    // delete document
    this.deleteDocument = () => {

      let collectionName = this.collectionName
      let docSelectionCriteria = this.docSelectionCriteria

      // delete document by criteria
      this.deleteDocumentByCriteria = () => {
        let keysForDeletion = []
        this.lf[collectionName].iterate((value, key) => {
          if (isSubset(value, docSelectionCriteria)) {
            keysForDeletion.push(key)
          }
        }).then(() => {
          if (!keysForDeletion.length) {
            reject(
              error.call(
                this,
                `${ JSON.stringify(docSelectionCriteria) } => "${ collectionName }" nomli collectionda document(lar) topilmadi. Hech qanday document o'chirilmadi.`
              )
            )
          }
          if (keysForDeletion.length > 1) {
            logger.warn.call(this, `${ JSON.stringify(docSelectionCriteria) } bilan (${ keysForDeletion.length }) ta document${ keysForDeletion.length > 1 ? 'lar' : '' } topildi.`)
          }
        }).then(() => {
          keysForDeletion.forEach((key, index) => {
            this.lf[collectionName].removeItem(key).then(() => {
              if (index === (keysForDeletion.length - 1)) {
                resolve(
                  success.call(
                    this,
                    `${ JSON.stringify(docSelectionCriteria) } bilan ${ keysForDeletion.length }ta document${ keysForDeletion.length > 1 ? 'lar' : '' } o'chirildi.`,
                    { keys: keysForDeletion }
                  )
                )
              }
            }).catch(err => {
              reject(
                error.call(
                  this,
                  `${ keysForDeletion.length } ta document${ keysForDeletion.length > 1 ? 'lar' : '' }ni ${ collectionName } nomli collectiondan o'chirilmadi.`
                )
              )
            })
          })
        })
      }

      // delete document by key
      this.deleteDocumentByKey = () => {
        this.lf[collectionName].getItem(docSelectionCriteria).then(value => {
          if (value) {
            this.lf[collectionName].removeItem(docSelectionCriteria).then(() => {
              resolve(
                success.call(
                  this,
                  `${ JSON.stringify(docSelectionCriteria) } kalitli document(lar) o'chirildi.`,
                  { key: docSelectionCriteria }
                )
              )
            }).catch(function(err) {
              reject(
                error.call(
                  this,
                  `"${ collectionName }" nomli collectionda ${ JSON.stringify(docSelectionCriteria) } kaliti bilan document(lar) topilmadi. Hech qanday document o'chirilmadi.`
                )
              )
            });
          }
          else {
            reject(
              error.call(
                this,
                `"${ collectionName }" nomli collectionda ${ JSON.stringify(docSelectionCriteria) } kaliti bilan document(lar) topilmadi. Hech qanday document o'chirilmadi.`
              )
            )
          }
        });

      }

      if (typeof docSelectionCriteria == 'object') {
        return this.deleteDocumentByCriteria()
      }
      else {
        return this.deleteDocumentByKey()
      }
    }
    
    if (!this.userErrors.length) {
      let currentSelectionLevel = selectionLevel.call(this)
  
      if (currentSelectionLevel == 'db') {
        return this.deleteDatabase()
      }
      else if (currentSelectionLevel == 'collection') {
        return this.deleteCollection()
      }
      else if (currentSelectionLevel == 'doc') {
        return this.deleteDocument()
      }
    }
    else {
      showUserErrors.call(this)
    }

  })

}