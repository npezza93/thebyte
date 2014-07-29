class AddAvatarToUsers < ActiveRecord::Migration
  def change
  	add_column :users, :image, :string, default: "../../../../default_pic.png"
  end
end
