class CreatePosts < ActiveRecord::Migration
  def change
    create_table :posts do |t|
      t.string :title
      t.string :subtitle
      t.string :author
      t.string :image
      t.string :altattr
      t.text :content

      t.timestamps
    end
  end
end
